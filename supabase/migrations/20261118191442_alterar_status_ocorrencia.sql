-- Gestor altera o status da ocorrência direto na lista do painel (SQUAD1-29, história SQUAD1-5).
-- Passa por função, e não por update livre do front: o gestor muda só o status, nunca a
-- descrição, o local ou quem registrou. Cada mudança fica em historico_status.

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

  select * into v_oco from public.ocorrencias where id = p_ocorrencia_id for update;

  -- Ocorrência de outro condomínio responde igual a inexistente: não revela que ela existe.
  if not found or not public.eh_gestor_aprovado(v_oco.condominio_id) then
    raise exception using errcode = '42501',
      message = 'Apenas o gestor do condomínio pode alterar o status desta ocorrência.';
  end if;

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
end;
$$;

comment on function public.alterar_status_ocorrencia(uuid, text) is
  'Gestor ativo do condomínio muda o status da ocorrência (novo, em_andamento, concluido) e grava o histórico.';

-- As migrações anteriores fecham funções novas para todos; aqui libera só para quem está logado.
revoke execute on function public.alterar_status_ocorrencia(uuid, text) from public, anon;
grant execute on function public.alterar_status_ocorrencia(uuid, text) to authenticated;
