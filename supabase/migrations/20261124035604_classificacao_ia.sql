-- Classificação das ocorrências pela IA (SQUAD1-59, história SQUAD1-53).
-- 1. A cada ocorrência nova, um gatilho avisa o ai-service pelo pg_net, em segundo plano.
-- 2. O ai-service classifica e grava o resultado pela função gravar_classificacao.
-- Proposta "Sprint 2 — Proposta da IA: classificação com Gemini e Pydantic AI" (23/11).

-- pg_net faz a chamada HTTP de dentro do banco, sem esperar a resposta.
create extension if not exists pg_net with schema extensions;

-- Schema para funções internas, que a API não expõe.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. De onde veio cada classificação
-- ---------------------------------------------------------------------------
-- ia: a Gemini respondeu. regra: a IA falhou e o classificador por regras decidiu.
-- "+trava": uma palavra de risco (gás, fumaça...) forçou a urgência para urgente.
-- Nulo nas linhas anteriores a esta migração.
alter table public.classificacoes_ia
  add column origem text
    check (origem is null or origem in ('ia', 'regra', 'ia+trava', 'regra+trava'));

-- ---------------------------------------------------------------------------
-- 2. Gravação da classificação (chamada só pelo ai-service, com a service_role)
-- ---------------------------------------------------------------------------
create or replace function public.gravar_classificacao(
  p_ocorrencia_id uuid,
  p_urgencia text,
  p_categoria text,
  p_justificativa text,
  p_origem text,
  p_modelo_versao text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_urgencia is null or p_urgencia not in ('urgente', 'alta', 'normal', 'baixa') then
    raise exception using errcode = '22023', message = 'Urgência inválida.';
  end if;
  if nullif(btrim(p_categoria), '') is null then
    raise exception using errcode = '22023', message = 'Informe a categoria.';
  end if;
  if nullif(btrim(p_justificativa), '') is null then
    raise exception using errcode = '22023', message = 'Informe a justificativa.';
  end if;
  if p_origem is null or p_origem not in ('ia', 'regra', 'ia+trava', 'regra+trava') then
    raise exception using errcode = '22023', message = 'Origem da classificação inválida.';
  end if;

  -- Trava a ocorrência: o webhook e o "classificar pendentes" podem chegar juntos.
  perform 1 from public.ocorrencias where id = p_ocorrencia_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Ocorrência não encontrada.';
  end if;

  -- Já classificada: devolve a classificação existente sem mudar nada. Assim o pg_net pode
  -- repetir o aviso, e o "classificar pendentes" pode rodar junto, sem duplicar o histórico.
  select c.id into v_id
  from public.classificacoes_ia c
  where c.ocorrencia_id = p_ocorrencia_id and c.status_processamento = 'sucesso'
  order by c.created_at
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.classificacoes_ia (
    ocorrencia_id, prioridade_sugerida, categoria_sugerida, justificativa,
    status_processamento, modelo_versao, origem
  )
  values (
    p_ocorrencia_id, p_urgencia, btrim(p_categoria), btrim(p_justificativa),
    'sucesso', nullif(btrim(p_modelo_versao), ''), p_origem
  )
  returning id into v_id;

  -- PENDENTE (SQUAD1-60): quando o gestor puder escolher a prioridade, não sobrescrever
  -- urgencia_atual se ele já tiver escolhido. A regra de como saber isso sai da 60.
  update public.ocorrencias
  set urgencia_atual = p_urgencia,
      categoria_atual = btrim(p_categoria),
      updated_at = now()
  where id = p_ocorrencia_id;

  return v_id;
end;
$$;

comment on function public.gravar_classificacao(uuid, text, text, text, text, text) is
  'ai-service grava a classificação da ocorrência: histórico em classificacoes_ia e urgencia_atual/categoria_atual. Repetir a chamada não duplica.';

-- Só o ai-service (service_role). O front nunca chama esta função.
revoke execute on function public.gravar_classificacao(uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.gravar_classificacao(uuid, text, text, text, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 3. Gatilho: avisa o ai-service a cada ocorrência nova
-- ---------------------------------------------------------------------------
-- O endereço e o segredo ficam no Vault de cada banco (local, stage e prod), nunca aqui:
--   select vault.create_secret('<endereço do ai-service>', 'ai_service_url');
--   select vault.create_secret('<segredo do webhook>', 'ai_webhook_secret');
-- Passo a passo no README.md da raiz (seção do ambiente local e de deploy).
create or replace function private.avisar_ai_service()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_segredo text;
begin
  -- Tudo dentro do bloco de exceção: nem o Vault nem o pg_net podem desfazer o registro
  -- da ocorrência. Sem aviso, ela fica em "Aguardando triagem" e o "classificar
  -- pendentes" pega depois.
  begin
    select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'ai_service_url';
    select decrypted_secret into v_segredo
    from vault.decrypted_secrets where name = 'ai_webhook_secret';

    if nullif(btrim(v_url), '') is null or nullif(btrim(v_segredo), '') is null then
      raise log 'avisar_ai_service: ai_service_url ou ai_webhook_secret ausente no Vault';
      return new;
    end if;

    -- Só id, descrição e local: nada de quem registrou.
    perform net.http_post(
      url := rtrim(btrim(v_url), '/') || '/webhook',
      body := jsonb_build_object('id', new.id, 'descricao', new.descricao, 'local', new.local),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Webhook-Secret', v_segredo
      ),
      -- 90 s: no plano grátis o Render dorme depois de 15 minutos e leva de 13 a 18 s para
      -- acordar. O pg_net é assíncrono (envia depois do commit), então o registro não espera.
      timeout_milliseconds := 90000
    );
  exception when others then
    raise log 'avisar_ai_service: falha ao avisar o ai-service: %', sqlerrm;
  end;

  return new;
end;
$$;

revoke execute on function private.avisar_ai_service() from public, anon, authenticated;

create trigger classificar_ocorrencia
  after insert on public.ocorrencias
  for each row execute function private.avisar_ai_service();
