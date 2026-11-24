-- Gestor confirma ou muda a prioridade da ocorrência (SQUAD1-60, história SQUAD1-53).
-- É assim que o síndico corrige os falsos urgentes da trava, como combinado com o Lucas.
-- Contrato (SQUAD1-56): a escolha do gestor sempre vence a IA e a trava.
--
-- Regras combinadas em 24/11 (docs/decisoes.md):
-- - O motivo do gestor é opcional.
-- - Confirmar a prioridade sugerida também conta como escolha: a IA não muda mais depois.
-- - Ocorrência concluída não muda de prioridade.

-- ---------------------------------------------------------------------------
-- 1. Nova ação em decisoes
-- ---------------------------------------------------------------------------
alter table public.decisoes drop constraint decisoes_acao_check;
alter table public.decisoes add constraint decisoes_acao_check
  check (acao in ('assumir', 'delegar', 'agendar', 'definir_prioridade'));

-- A decisão de prioridade sempre traz a urgência escolhida.
alter table public.decisoes add constraint decisoes_prioridade_com_urgencia
  check (acao <> 'definir_prioridade' or urgencia_definida is not null);

-- ---------------------------------------------------------------------------
-- 2. Gestor define a prioridade
-- ---------------------------------------------------------------------------
create or replace function public.definir_prioridade_ocorrencia(
  p_ocorrencia_id uuid,
  p_urgencia text,
  p_justificativa text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_classificacao uuid;
  v_id uuid;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'Entre na sua conta para alterar a prioridade.';
  end if;
  if p_urgencia is null or p_urgencia not in ('urgente', 'alta', 'normal', 'baixa') then
    raise exception using errcode = '22023', message = 'Prioridade inválida.';
  end if;
  -- Mesmo limite da descrição da ocorrência.
  if char_length(p_justificativa) > 800 then
    raise exception using errcode = '22023', message = 'O motivo pode ter no máximo 800 caracteres.';
  end if;

  -- Autoriza antes de travar a linha. Ocorrência de outro condomínio responde igual a
  -- inexistente: não revela que ela existe.
  if not exists (
    select 1 from public.ocorrencias o
    where o.id = p_ocorrencia_id and public.eh_gestor_aprovado(o.condominio_id)
  ) then
    raise exception using errcode = '42501',
      message = 'Apenas o gestor do condomínio pode alterar a prioridade desta ocorrência.';
  end if;

  select status into v_status from public.ocorrencias where id = p_ocorrencia_id for update;

  if v_status = 'concluido' then
    raise exception using errcode = '22023',
      message = 'Não é possível alterar a prioridade de uma ocorrência concluída.';
  end if;

  -- A decisão aponta para a sugestão da IA que o gestor confirmou ou corrigiu, se houver.
  select c.id into v_classificacao
  from public.classificacoes_ia c
  where c.ocorrencia_id = p_ocorrencia_id and c.status_processamento = 'sucesso'
  order by c.created_at desc
  limit 1;

  insert into public.decisoes (
    ocorrencia_id, autor_id, classificacao_ia_id, urgencia_definida, justificativa, acao
  )
  values (
    p_ocorrencia_id, v_uid, v_classificacao, p_urgencia,
    nullif(btrim(p_justificativa), ''), 'definir_prioridade'
  )
  returning id into v_id;

  update public.ocorrencias
  set urgencia_atual = p_urgencia,
      updated_at = now()
  where id = p_ocorrencia_id;

  return v_id;
end;
$$;

comment on function public.definir_prioridade_ocorrencia(uuid, text, text) is
  'Gestor ativo do condomínio confirma ou muda a prioridade (motivo opcional); grava em decisoes. A IA não sobrescreve mais.';

revoke execute on function public.definir_prioridade_ocorrencia(uuid, text, text) from public, anon;
grant execute on function public.definir_prioridade_ocorrencia(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. A IA não sobrescreve a escolha do gestor
-- ---------------------------------------------------------------------------
-- Mesma função da migração 20261124035604_classificacao_ia.sql, agora sem mexer em
-- urgencia_atual quando o gestor já escolheu (ex.: ele decidiu antes de a IA responder).
-- O histórico em classificacoes_ia e a categoria continuam sendo gravados.
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
  v_gestor_escolheu boolean;
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

  -- Trava a ocorrência: o webhook, o "classificar pendentes" e o gestor podem chegar juntos.
  perform 1 from public.ocorrencias where id = p_ocorrencia_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Ocorrência não encontrada.';
  end if;

  -- Já classificada: devolve a classificação existente sem mudar nada.
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

  v_gestor_escolheu := exists (
    select 1 from public.decisoes d
    where d.ocorrencia_id = p_ocorrencia_id and d.acao = 'definir_prioridade'
  );

  update public.ocorrencias
  set urgencia_atual = case when v_gestor_escolheu then urgencia_atual else p_urgencia end,
      categoria_atual = btrim(p_categoria),
      updated_at = now()
  where id = p_ocorrencia_id;

  return v_id;
end;
$$;

comment on function public.gravar_classificacao(uuid, text, text, text, text, text) is
  'ai-service grava a classificação: histórico em classificacoes_ia, categoria_atual e urgencia_atual (esta só se o gestor ainda não definiu a prioridade). Repetir a chamada não duplica.';

-- create or replace mantém os grants da migração anterior (só a service_role executa).
