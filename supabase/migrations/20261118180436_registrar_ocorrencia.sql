-- Morador registra ocorrência (SQUAD1-27, história SQUAD1-5).
-- O registro passa por função, e não por insert livre do front: o banco decide o condomínio
-- (pelo vínculo ativo do morador), quem registrou e o status inicial.

-- Descrição com até 800 caracteres, como na história.
alter table public.ocorrencias
  add constraint ocorrencias_descricao_tamanho check (char_length(descricao) <= 800);

-- Registra uma ocorrência em nome de quem chama.
-- p_condominio_id só é obrigatório quando a pessoa tem vínculo ativo em mais de um condomínio.
create or replace function public.registrar_ocorrencia(
  p_descricao text,
  p_local text default null,
  p_condominio_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_descricao text := pg_catalog.btrim(coalesce(p_descricao, ''));
  v_local text := nullif(pg_catalog.btrim(coalesce(p_local, '')), '');
  v_condominios uuid[];
  v_condominio_id uuid;
  v_id uuid;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'Entre na sua conta para registrar uma ocorrência.';
  end if;
  -- Funcionário se cadastra como morador (role morador); gestor e admin não registram por aqui.
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'morador') then
    raise exception using errcode = '42501', message = 'Apenas moradores registram ocorrências.';
  end if;
  if v_descricao = '' then
    raise exception using errcode = '22023', message = 'Descreva o problema.';
  end if;
  if pg_catalog.char_length(v_descricao) > 800 then
    raise exception using errcode = '22023', message = 'A descrição pode ter no máximo 800 caracteres.';
  end if;

  -- Condomínios em que a pessoa é morador (ou funcionário) com vínculo ativo e vigente.
  select coalesce(array_agg(distinct v.condominio_id), '{}') into v_condominios
  from public.vinculos v
  where v.usuario_id = v_uid
    and v.tipo in ('morador', 'funcionario')
    and v.status = 'ativo'
    and v.inicio_vigencia <= current_date
    and (v.fim_vigencia is null or v.fim_vigencia >= current_date);

  if pg_catalog.cardinality(v_condominios) = 0 then
    raise exception using errcode = '42501',
      message = 'Você precisa ter o cadastro aprovado em um condomínio para registrar ocorrências.';
  end if;

  if p_condominio_id is not null then
    if not (p_condominio_id = any (v_condominios)) then
      raise exception using errcode = '42501', message = 'Você não tem vínculo ativo com este condomínio.';
    end if;
    v_condominio_id := p_condominio_id;
  elsif pg_catalog.cardinality(v_condominios) = 1 then
    v_condominio_id := v_condominios[1];
  else
    raise exception using errcode = '22023', message = 'Escolha o condomínio da ocorrência.';
  end if;

  insert into public.ocorrencias (condominio_id, registrado_por, local, descricao)
  values (v_condominio_id, v_uid, v_local, v_descricao)
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.registrar_ocorrencia(text, text, uuid) is
  'Morador (ou funcionário) com vínculo ativo registra uma ocorrência em nome próprio. Status inicial novo; campos da IA vazios.';

-- As migrações anteriores fecham funções novas para todos; aqui libera só para quem está logado.
revoke execute on function public.registrar_ocorrencia(text, text, uuid) from public, anon;
grant execute on function public.registrar_ocorrencia(text, text, uuid) to authenticated;
