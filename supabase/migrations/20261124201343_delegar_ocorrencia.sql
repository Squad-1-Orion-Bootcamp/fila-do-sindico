-- Funções do gestor para a delegação (SQUAD1-74, história SQUAD1-54, US 3).
-- Regra 5: tudo por função, nada de update livre. Decisões do link em docs/decisoes.md
-- (SQUAD1-72): trocar o responsável é delegar de novo; qualquer troca de status pelo gestor
-- revoga o link ativo ("assumir de volta" é isso).

-- ---------------------------------------------------------------------------
-- 1. Delegar (ou trocar o responsável)
-- ---------------------------------------------------------------------------
-- Devolve o token do link UMA vez: o banco guarda só o hash (SQUAD1-73). O front monta o link
-- do WhatsApp com ele (SQUAD1-76). Para mandar de novo, delega de novo.
create or replace function public.delegar_ocorrencia(p_ocorrencia_id uuid, p_funcionario_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_oco public.ocorrencias%rowtype;
  v_token text;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'Entre na sua conta para delegar a ocorrência.';
  end if;

  -- Autoriza antes de travar a linha. Ocorrência de outro condomínio responde igual a
  -- inexistente: não revela que ela existe.
  if not exists (
    select 1 from public.ocorrencias o
    where o.id = p_ocorrencia_id and public.eh_gestor_aprovado(o.condominio_id)
  ) then
    raise exception using errcode = '42501',
      message = 'Apenas o gestor do condomínio pode delegar esta ocorrência.';
  end if;

  select * into v_oco from public.ocorrencias where id = p_ocorrencia_id for update;

  -- A reabertura de ocorrências concluídas está fora da US 3.
  if v_oco.status = 'concluido' then
    raise exception using errcode = '22023',
      message = 'Não é possível delegar uma ocorrência concluída.';
  end if;

  -- O funcionário precisa estar ativo e ser do mesmo condomínio da ocorrência.
  if not exists (
    select 1 from public.funcionarios f
    where f.id = p_funcionario_id and f.ativo and f.condominio_id = v_oco.condominio_id
  ) then
    raise exception using errcode = '22023',
      message = 'Funcionário não encontrado ou inativo neste condomínio.';
  end if;

  -- Trocar o responsável: o link anterior para de valer.
  update public.delegacoes
  set situacao = 'revogada', revogada_em = now()
  where ocorrencia_id = p_ocorrencia_id and situacao = 'ativa';

  -- Token de 32 bytes aleatórios em base64url (43 caracteres, sem "=").
  v_token := pg_catalog.rtrim(
    pg_catalog.translate(pg_catalog.encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'),
    '='
  );

  insert into public.delegacoes (ocorrencia_id, condominio_id, funcionario_id, token_hash, criado_por)
  values (
    p_ocorrencia_id, v_oco.condominio_id, p_funcionario_id,
    extensions.digest(v_token, 'sha256'), v_uid
  );

  if v_oco.status <> 'delegado' then
    update public.ocorrencias
    set status = 'delegado',
        concluido_em = null,
        updated_at = now()
    where id = p_ocorrencia_id;

    insert into public.historico_status (ocorrencia_id, autor_id, status_anterior, status_novo)
    values (p_ocorrencia_id, v_uid, v_oco.status, 'delegado');
  else
    update public.ocorrencias set updated_at = now() where id = p_ocorrencia_id;
  end if;

  return v_token;
end;
$$;

comment on function public.delegar_ocorrencia(uuid, uuid) is
  'Gestor ativo delega a ocorrência a um funcionário ativo do mesmo condomínio. Revoga a delegação anterior, muda o status para delegado e devolve o token do link uma vez.';

revoke execute on function public.delegar_ocorrencia(uuid, uuid) from public, anon;
grant execute on function public.delegar_ocorrencia(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Troca manual de status revoga o link ativo
-- ---------------------------------------------------------------------------
-- Mesma função de 20261118191442_alterar_status_ocorrencia.sql, agora revogando a delegação
-- ativa quando o status muda. Continua sem aceitar 'delegado' como destino.
create or replace function public.alterar_status_ocorrencia(p_ocorrencia_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_oco public.ocorrencias%rowtype;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'Entre na sua conta para alterar o status.';
  end if;
  if p_status is null or p_status not in ('novo', 'em_andamento', 'concluido') then
    raise exception using errcode = '22023', message = 'Status inválido.';
  end if;

  -- Autoriza antes de travar a linha. Ocorrência de outro condomínio responde igual a
  -- inexistente: não revela que ela existe.
  if not exists (
    select 1 from public.ocorrencias o
    where o.id = p_ocorrencia_id and public.eh_gestor_aprovado(o.condominio_id)
  ) then
    raise exception using errcode = '42501',
      message = 'Apenas o gestor do condomínio pode alterar o status desta ocorrência.';
  end if;

  select * into v_oco from public.ocorrencias where id = p_ocorrencia_id for update;

  if v_oco.status = p_status then
    return;
  end if;

  update public.ocorrencias
  set status = p_status,
      concluido_em = case when p_status = 'concluido' then now() else null end,
      updated_at = now()
  where id = p_ocorrencia_id;

  insert into public.historico_status (ocorrencia_id, autor_id, status_anterior, status_novo)
  values (p_ocorrencia_id, v_uid, v_oco.status, p_status);

  -- Qualquer troca de status pelo gestor revoga o link ativo (decisão do Lucas, SQUAD1-72).
  update public.delegacoes
  set situacao = 'revogada', revogada_em = now()
  where ocorrencia_id = p_ocorrencia_id and situacao = 'ativa';
end;
$$;

comment on function public.alterar_status_ocorrencia(uuid, text) is
  'Gestor ativo do condomínio muda o status da ocorrência (novo, em_andamento, concluido), grava o histórico e revoga a delegação ativa.';

-- create or replace mantém os grants (só authenticated executa).
