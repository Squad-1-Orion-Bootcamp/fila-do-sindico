-- Gestor registra ocorrência que chegou por outro canal (SQUAD1-30, história SQUAD1-5).
-- O registro passa por função: o banco confere se quem chama é gestor do condomínio e se o
-- morador informado em relatado_por tem vínculo ativo naquele condomínio.

-- Canal de origem. As ocorrências do morador (e as que já existem) ficam como 'aplicativo'.
alter table public.ocorrencias
  add column origem text not null default 'aplicativo'
    constraint ocorrencias_origem_valida
    check (origem in ('aplicativo', 'whatsapp', 'telefone', 'presencial', 'vistoria'));

-- Quem relatou ao gestor (opcional): um morador ou funcionário cadastrado no condomínio.
alter table public.ocorrencias
  add column relatado_por uuid references public.profiles (id);

create index ocorrencias_relatado_por_idx on public.ocorrencias (relatado_por);

-- Registra uma ocorrência em nome do gestor que chama, num condomínio em que ele tem vínculo ativo.
create or replace function public.registrar_ocorrencia_gestor(
  p_condominio_id uuid,
  p_descricao text,
  p_origem text,
  p_local text default null,
  p_relatado_por uuid default null
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
  v_id uuid;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'Entre na sua conta para registrar uma ocorrência.';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'gestor') then
    raise exception using errcode = '42501', message = 'Apenas gestores registram ocorrências por aqui.';
  end if;
  if p_condominio_id is null then
    raise exception using errcode = '22023', message = 'Escolha o condomínio da ocorrência.';
  end if;
  if not public.eh_gestor_aprovado(p_condominio_id) then
    raise exception using errcode = '42501', message = 'Você não é gestor deste condomínio.';
  end if;
  if v_descricao = '' then
    raise exception using errcode = '22023', message = 'Descreva o problema.';
  end if;
  if pg_catalog.char_length(v_descricao) > 800 then
    raise exception using errcode = '22023', message = 'A descrição pode ter no máximo 800 caracteres.';
  end if;
  -- 'aplicativo' é a origem das ocorrências que o próprio morador registra.
  if p_origem is null or p_origem not in ('whatsapp', 'telefone', 'presencial', 'vistoria') then
    raise exception using errcode = '22023', message = 'Escolha o canal de origem da ocorrência.';
  end if;

  if p_relatado_por is not null and not exists (
    select 1
    from public.vinculos v
    where v.usuario_id = p_relatado_por
      and v.condominio_id = p_condominio_id
      and v.tipo in ('morador', 'funcionario')
      and v.status = 'ativo'
      and v.inicio_vigencia <= current_date
      and (v.fim_vigencia is null or v.fim_vigencia >= current_date)
  ) then
    raise exception using errcode = '22023', message = 'Quem relatou precisa ser um morador ativo deste condomínio.';
  end if;

  insert into public.ocorrencias (condominio_id, registrado_por, relatado_por, origem, local, descricao)
  values (p_condominio_id, v_uid, p_relatado_por, p_origem, v_local, v_descricao)
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.registrar_ocorrencia_gestor(uuid, text, text, text, uuid) is
  'Gestor com vínculo ativo registra ocorrência recebida por outro canal (whatsapp, telefone, presencial, vistoria), opcionalmente informando o morador que relatou.';

-- As migrações anteriores fecham funções novas para todos; aqui libera só para quem está logado.
revoke execute on function public.registrar_ocorrencia_gestor(uuid, text, text, text, uuid) from public, anon;
grant execute on function public.registrar_ocorrencia_gestor(uuid, text, text, text, uuid) to authenticated;

