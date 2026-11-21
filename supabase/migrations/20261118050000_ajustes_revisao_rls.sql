-- Ajustes apontados pelo revisor-rls na PR do modelo de dados (SQUAD1-36).

-- ---------------------------------------------------------------------------
-- 1. Objetos criados nas próximas migrações nascem fechados para a API.
--    O "revoke all on all tables/functions" da migração anterior só valeu para o que já
--    existia. Sem isto, tabela ou função nova ganharia acesso de anon e authenticated
--    sem ninguém dar grant. Toda migração nova precisa dar os grants que o front usa.
-- ---------------------------------------------------------------------------
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
-- O Postgres dá execute em funções para PUBLIC no banco todo; o revoke por schema não tira isso.
alter default privileges for role postgres revoke execute on functions from public;

-- ---------------------------------------------------------------------------
-- 2. Condomínios: a lista pública fica só para o visitante (anon), que já é limitado a
--    id e nome. O usuário logado vê os condomínios em que tem vínculo ativo e vigente
--    (o morador continua vendo o próprio condomínio mesmo sem gestor ativo) e o admin
--    vê todos (política condominios_ler_admin, já existente).
-- ---------------------------------------------------------------------------
drop policy condominios_listagem_para_cadastro on public.condominios;

create policy condominios_listagem_para_cadastro on public.condominios
  for select to anon
  using (public.condominio_aceita_cadastro(id));

create policy condominios_ler_vinculados on public.condominios
  for select to authenticated
  using (
    exists (
      select 1 from public.vinculos v
      where v.condominio_id = condominios.id
        and v.usuario_id = (select auth.uid())
        and v.status = 'ativo'
        and v.inicio_vigencia <= current_date
        and (v.fim_vigencia is null or v.fim_vigencia >= current_date)
    )
  );

revoke execute on function public.condominio_aceita_cadastro(uuid) from authenticated;

-- ---------------------------------------------------------------------------
-- 3. Ninguém encerra o próprio vínculo (como já diz supabase/AGENTS.md).
-- ---------------------------------------------------------------------------
create or replace function public.encerrar_vinculo(p_vinculo_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_vin public.vinculos%rowtype;
begin
  if nullif(pg_catalog.btrim(coalesce(p_motivo, '')), '') is null then
    raise exception using errcode = '22023', message = 'Informe o motivo do encerramento.';
  end if;

  select * into v_vin from public.vinculos where id = p_vinculo_id for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Vínculo não encontrado.';
  end if;
  if v_vin.usuario_id = v_uid then
    raise exception using errcode = '42501', message = 'Não é permitido encerrar o próprio vínculo.';
  end if;
  if v_vin.status <> 'ativo' then
    raise exception using errcode = '22023', message = 'O vínculo já está encerrado.';
  end if;

  if v_vin.tipo = 'gestor' then
    if not public.eh_admin_plataforma() then
      raise exception using errcode = '42501', message = 'Apenas administradores podem encerrar o vínculo de um gestor.';
    end if;
  elsif not (public.eh_admin_plataforma() or public.eh_gestor_aprovado(v_vin.condominio_id)) then
    raise exception using errcode = '42501',
      message = 'Apenas o gestor do condomínio ou um administrador pode encerrar este vínculo.';
  end if;

  update public.vinculos
  set status = 'encerrado',
      fim_vigencia = greatest(current_date, inicio_vigencia),
      encerrado_por = v_uid,
      encerrado_em = now(),
      motivo_encerramento = pg_catalog.btrim(p_motivo)
  where id = p_vinculo_id;
end;
$$;
