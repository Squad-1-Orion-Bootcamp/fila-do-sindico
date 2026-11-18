-- Modelo de dados da Fila do Síndico (documento "Modelo de dados da Fila do Síndico").
--
-- Organização deste arquivo:
--   1. Tabelas e índices
--   2. Funções de autorização
--   3. Cadastro: trigger que cria o perfil e papel de admin
--   4. Políticas de acesso (RLS)
--   5. Funções de aprovação, recusa e encerramento
--   6. Permissões dos papéis da API (anon e authenticated)
--   7. Storage: documentos comprobatórios
--
-- Regras de acesso:
--   - O acesso a um condomínio depende de vínculo ativo e vigente (eh_gestor_aprovado).
--   - Ser gestor de um condomínio não dá acesso aos demais.
--   - Escritas sensíveis (cadastrar condomínio, aprovar, recusar, encerrar) só por função,
--     nunca por insert ou update livre.
--   - Sprint 1: o gestor cadastra o condomínio e já começa a usar (cadastrar_condominio).
--     A análise pelo admin (solicitacoes_condominio) fica pronta para depois.
--
-- Fica para o futuro: conversas e mensagens (chat da ocorrência), registro de ocorrências
-- e anexos pelo front.

-- ===========================================================================
-- 1. Tabelas e índices
-- ===========================================================================

-- Admin da plataforma: uma conta individual para cada pessoa do time.
create table public.administradores_plataforma (
  usuario_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Cadastro permanente do condomínio. Permanece quando o síndico ou a administradora muda.
create table public.condominios (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  cnpj text unique constraint condominios_cnpj_formato check (cnpj is null or cnpj ~ '^[0-9]{14}$'),
  criado_por uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index condominios_criado_por_idx on public.condominios (criado_por);

-- Unidades do condomínio.
create table public.imoveis (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id),
  bloco text not null default '',
  unidade text not null check (btrim(unidade) <> ''),
  created_at timestamptz not null default now(),
  unique (condominio_id, bloco, unidade),
  unique (id, condominio_id)
);

-- Quem acessa qual condomínio, como gestor, morador ou funcionário.
create table public.vinculos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.profiles (id),
  condominio_id uuid not null references public.condominios (id),
  tipo text not null check (tipo in ('gestor', 'morador', 'funcionario')),
  status text not null default 'ativo' check (status in ('ativo', 'encerrado')),
  aprovado_por uuid not null references public.profiles (id),
  aprovado_em timestamptz not null default now(),
  inicio_vigencia date not null default current_date,
  fim_vigencia date,
  encerrado_por uuid references public.profiles (id),
  encerrado_em timestamptz,
  motivo_encerramento text,
  created_at timestamptz not null default now(),
  unique (id, condominio_id),
  constraint vinculos_datas_validas check (fim_vigencia is null or fim_vigencia >= inicio_vigencia),
  constraint vinculos_status_vigencia check (
    (status = 'ativo' and fim_vigencia is null)
    or (status = 'encerrado' and fim_vigencia is not null)
  ),
  constraint vinculos_encerramento_consistente check (
    (status = 'ativo' and encerrado_por is null and encerrado_em is null and motivo_encerramento is null)
    or (status = 'encerrado' and encerrado_em is not null)
  )
);

create unique index vinculos_sem_duplicata_ativa
  on public.vinculos (usuario_id, condominio_id, tipo) where status = 'ativo';
create index vinculos_condominio_id_idx on public.vinculos (condominio_id);
create index vinculos_aprovado_por_idx on public.vinculos (aprovado_por);
create index vinculos_encerrado_por_idx on public.vinculos (encerrado_por);

-- Unidades de cada vínculo (um morador pode ter mais de um imóvel; funcionário não tem).
create table public.vinculos_imovel (
  id uuid primary key default gen_random_uuid(),
  vinculo_id uuid not null,
  imovel_id uuid not null,
  condominio_id uuid not null,
  created_at timestamptz not null default now(),
  unique (vinculo_id, imovel_id),
  foreign key (vinculo_id, condominio_id) references public.vinculos (id, condominio_id),
  foreign key (imovel_id, condominio_id) references public.imoveis (id, condominio_id)
);

create index vinculos_imovel_vinculo_condominio_idx on public.vinculos_imovel (vinculo_id, condominio_id);
create index vinculos_imovel_imovel_condominio_idx on public.vinculos_imovel (imovel_id, condominio_id);

-- Pedido de cadastro do condomínio e do primeiro gestor. Um admin analisa.
create table public.solicitacoes_condominio (
  id uuid primary key default gen_random_uuid(),
  solicitante_id uuid not null references public.profiles (id),
  nome_condominio text not null check (btrim(nome_condominio) <> ''),
  cnpj text constraint solicitacoes_condominio_cnpj_formato check (cnpj is null or cnpj ~ '^[0-9]{14}$'),
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'recusada')),
  analisado_por uuid references public.profiles (id),
  analisado_em timestamptz,
  motivo_recusa text,
  condominio_criado_id uuid unique references public.condominios (id),
  vinculo_gestor_id uuid unique references public.vinculos (id),
  created_at timestamptz not null default now()
);

create unique index solicitacoes_condominio_cnpj_pendente_unico
  on public.solicitacoes_condominio (cnpj) where status = 'pendente' and cnpj is not null;
create index solicitacoes_condominio_solicitante_id_idx on public.solicitacoes_condominio (solicitante_id);
create index solicitacoes_condominio_analisado_por_idx on public.solicitacoes_condominio (analisado_por);

-- Pré-cadastro e pedidos de acesso a um condomínio ou imóvel. O gestor do condomínio analisa.
-- Funcionário, por enquanto, se cadastra como morador.
create table public.solicitacoes_vinculo (
  id uuid primary key default gen_random_uuid(),
  solicitante_id uuid not null references public.profiles (id),
  condominio_id uuid not null references public.condominios (id),
  imovel_id uuid,
  tipo_solicitado text not null check (tipo_solicitado in ('gestor', 'morador')),
  bloco_solicitado text not null default '',
  unidade_solicitada text,
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'recusada')),
  analisado_por uuid references public.profiles (id),
  analisado_em timestamptz,
  motivo_recusa text,
  vinculo_aprovado_id uuid unique references public.vinculos (id),
  created_at timestamptz not null default now(),
  constraint solicitacao_imovel_no_mesmo_condominio
    foreign key (imovel_id, condominio_id) references public.imoveis (id, condominio_id),
  constraint solicitacao_unidade_por_tipo check (
    (tipo_solicitado = 'morador' and unidade_solicitada is not null and btrim(unidade_solicitada) <> '')
    or (tipo_solicitado = 'gestor' and unidade_solicitada is null and bloco_solicitado = '')
  )
);

create unique index solicitacoes_vinculo_pendente_unica
  on public.solicitacoes_vinculo (solicitante_id, condominio_id, tipo_solicitado, bloco_solicitado, coalesce(unidade_solicitada, ''))
  where status = 'pendente';
create index solicitacoes_vinculo_condominio_id_idx on public.solicitacoes_vinculo (condominio_id);
create index solicitacoes_vinculo_imovel_condominio_idx on public.solicitacoes_vinculo (imovel_id, condominio_id);
create index solicitacoes_vinculo_analisado_por_idx on public.solicitacoes_vinculo (analisado_por);

-- Comprovantes enviados, guardados no bucket privado "documentos".
create table public.documentos_comprobatorios (
  id uuid primary key default gen_random_uuid(),
  solicitacao_condominio_id uuid references public.solicitacoes_condominio (id) on delete cascade,
  solicitacao_vinculo_id uuid references public.solicitacoes_vinculo (id) on delete cascade,
  storage_path text not null unique,
  nome_original text not null,
  tipo_mime text,
  tamanho_bytes bigint check (tamanho_bytes is null or tamanho_bytes > 0),
  created_at timestamptz not null default now(),
  constraint documento_de_uma_solicitacao
    check ((solicitacao_condominio_id is not null) <> (solicitacao_vinculo_id is not null))
);

create index documentos_comprobatorios_sol_condominio_idx on public.documentos_comprobatorios (solicitacao_condominio_id);
create index documentos_comprobatorios_sol_vinculo_idx on public.documentos_comprobatorios (solicitacao_vinculo_id);

-- Ocorrências. Urgência e categoria ficam vazias até a triagem ("Aguardando triagem").
create table public.ocorrencias (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id),
  registrado_por uuid not null references public.profiles (id),
  imovel_id uuid,
  local text,
  descricao text not null check (btrim(descricao) <> ''),
  status text not null default 'novo' check (status in ('novo', 'em_andamento', 'concluido')),
  urgencia_atual text check (urgencia_atual is null or urgencia_atual in ('urgente', 'alta', 'normal', 'baixa')),
  categoria_atual text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  concluido_em timestamptz,
  unique (id, condominio_id),
  foreign key (imovel_id, condominio_id) references public.imoveis (id, condominio_id),
  constraint ocorrencias_data_conclusao check (
    (status = 'concluido' and concluido_em is not null)
    or (status <> 'concluido' and concluido_em is null)
  )
);

create index ocorrencias_por_condominio_status on public.ocorrencias (condominio_id, status, created_at);
create index ocorrencias_por_solicitante on public.ocorrencias (registrado_por, created_at);
create index ocorrencias_imovel_condominio_idx on public.ocorrencias (imovel_id, condominio_id);

create table public.anexos (
  id uuid primary key default gen_random_uuid(),
  ocorrencia_id uuid not null references public.ocorrencias (id),
  storage_path text not null unique,
  nome_original text not null,
  tipo_mime text,
  tamanho_bytes bigint check (tamanho_bytes is null or tamanho_bytes > 0),
  created_at timestamptz not null default now()
);

create index anexos_ocorrencia_id_idx on public.anexos (ocorrencia_id);

-- Sugestões da IA (Sprint 2).
create table public.classificacoes_ia (
  id uuid primary key default gen_random_uuid(),
  ocorrencia_id uuid not null references public.ocorrencias (id),
  prioridade_sugerida text check (prioridade_sugerida is null or prioridade_sugerida in ('urgente', 'alta', 'normal', 'baixa')),
  categoria_sugerida text,
  justificativa text,
  status_processamento text not null default 'pendente'
    check (status_processamento in ('pendente', 'processando', 'sucesso', 'falha')),
  modelo_versao text,
  created_at timestamptz not null default now()
);

create index classificacoes_ia_ocorrencia_id_idx on public.classificacoes_ia (ocorrencia_id);

-- Decisões humanas sobre a ocorrência.
create table public.decisoes (
  id uuid primary key default gen_random_uuid(),
  ocorrencia_id uuid not null references public.ocorrencias (id),
  autor_id uuid not null references public.profiles (id),
  classificacao_ia_id uuid references public.classificacoes_ia (id),
  urgencia_definida text check (urgencia_definida is null or urgencia_definida in ('urgente', 'alta', 'normal', 'baixa')),
  justificativa text,
  acao text not null check (acao in ('assumir', 'delegar', 'agendar')),
  destinatario text,
  agendado_para timestamptz,
  nota text,
  created_at timestamptz not null default now(),
  constraint decisoes_dados_da_acao check (
    (acao <> 'delegar' or nullif(btrim(destinatario), '') is not null)
    and (acao <> 'agendar' or agendado_para is not null)
  )
);

create index decisoes_ocorrencia_id_idx on public.decisoes (ocorrencia_id);
create index decisoes_autor_id_idx on public.decisoes (autor_id);
create index decisoes_classificacao_ia_id_idx on public.decisoes (classificacao_ia_id);

create table public.historico_status (
  id uuid primary key default gen_random_uuid(),
  ocorrencia_id uuid not null references public.ocorrencias (id),
  autor_id uuid references public.profiles (id),
  status_anterior text check (status_anterior is null or status_anterior in ('novo', 'em_andamento', 'concluido')),
  status_novo text not null check (status_novo in ('novo', 'em_andamento', 'concluido')),
  created_at timestamptz not null default now()
);

create index historico_status_ocorrencia_id_idx on public.historico_status (ocorrencia_id);
create index historico_status_autor_id_idx on public.historico_status (autor_id);

alter table public.administradores_plataforma enable row level security;
alter table public.condominios enable row level security;
alter table public.imoveis enable row level security;
alter table public.vinculos enable row level security;
alter table public.vinculos_imovel enable row level security;
alter table public.solicitacoes_condominio enable row level security;
alter table public.solicitacoes_vinculo enable row level security;
alter table public.documentos_comprobatorios enable row level security;
alter table public.ocorrencias enable row level security;
alter table public.anexos enable row level security;
alter table public.classificacoes_ia enable row level security;
alter table public.decisoes enable row level security;
alter table public.historico_status enable row level security;

-- ===========================================================================
-- 2. Funções de autorização (usadas nas políticas)
-- ===========================================================================

create or replace function public.eh_admin_plataforma()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.administradores_plataforma a
    where a.usuario_id = (select auth.uid())
  );
$$;

-- Gestor com vínculo ativo e vigente naquele condomínio.
create or replace function public.eh_gestor_aprovado(p_condominio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.vinculos v
    where v.usuario_id = (select auth.uid())
      and v.condominio_id = p_condominio_id
      and v.tipo = 'gestor'
      and v.status = 'ativo'
      and v.inicio_vigencia <= current_date
      and (v.fim_vigencia is null or v.fim_vigencia >= current_date)
  );
$$;

-- Condomínio que aparece na lista pública do cadastro: só os que têm gestor ativo.
create or replace function public.condominio_aceita_cadastro(p_condominio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.vinculos v
    where v.condominio_id = p_condominio_id
      and v.tipo = 'gestor'
      and v.status = 'ativo'
      and v.inicio_vigencia <= current_date
      and (v.fim_vigencia is null or v.fim_vigencia >= current_date)
  );
$$;

-- ===========================================================================
-- 3. Cadastro: perfil criado pelo banco e papel de admin
-- ===========================================================================

-- Cria o perfil a partir do cadastro (supabase.auth.signUp com options.data).
-- Campos esperados em options.data:
--   nome           obrigatório
--   tipo_cadastro  'gestor' ou 'morador' (funcionário se cadastra como morador)
--   condominio_id  obrigatório para morador; o condomínio precisa ter gestor ativo
--   unidade        obrigatório para morador
-- tipo_cadastro só é usado aqui, no momento do cadastro: o papel fica em profiles.role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome text;
  v_tipo_cadastro text;
  v_condominio_texto text;
  v_condominio_id uuid;
  v_unidade text;
begin
  v_nome := nullif(pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'nome', '')), '');
  v_tipo_cadastro := pg_catalog.lower(pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'tipo_cadastro', '')));

  if v_nome is null then
    raise exception using errcode = '22023', message = 'O campo nome é obrigatório.';
  end if;

  if v_tipo_cadastro not in ('gestor', 'morador') then
    raise exception using errcode = '22023', message = 'tipo_cadastro deve ser gestor ou morador.';
  end if;

  if v_tipo_cadastro = 'morador' then
    v_condominio_texto := nullif(pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'condominio_id', '')), '');
    if v_condominio_texto is null then
      raise exception using errcode = '22023', message = 'condominio_id é obrigatório para cadastro de morador.';
    end if;

    begin
      v_condominio_id := v_condominio_texto::uuid;
    exception
      when invalid_text_representation then
        raise exception using errcode = '22023', message = 'condominio_id deve ser um UUID válido.';
    end;

    v_unidade := nullif(pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'unidade', '')), '');
    if v_unidade is null then
      raise exception using errcode = '22023', message = 'unidade é obrigatória para cadastro de morador.';
    end if;

    if not exists (select 1 from public.condominios c where c.id = v_condominio_id) then
      raise exception using errcode = '22023', message = 'O condomínio informado não existe.';
    end if;

    if not public.condominio_aceita_cadastro(v_condominio_id) then
      raise exception using errcode = '22023',
        message = 'O condomínio ainda não possui gestor ativo para analisar a solicitação.';
    end if;
  end if;

  insert into public.profiles (id, role, nome)
  values (new.id, v_tipo_cadastro, v_nome);

  if v_tipo_cadastro = 'morador' then
    insert into public.solicitacoes_vinculo (solicitante_id, condominio_id, tipo_solicitado, unidade_solicitada)
    values (new.id, v_condominio_id, 'morador', v_unidade);
  end if;

  return new;
end;
$$;

create trigger fila_sindico_criar_perfil
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Conta incluída em administradores_plataforma passa a ter role = 'admin'.
-- Inclusão feita pelo time no Studio (cada pessoa com a própria conta).
create or replace function public.definir_papel_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set role = 'admin' where id = new.usuario_id;
  return new;
end;
$$;

create trigger administradores_definir_papel
  after insert on public.administradores_plataforma
  for each row execute function public.definir_papel_admin();

-- ===========================================================================
-- 4. Políticas de acesso
--    Sem política para uma operação = operação proibida pelo front.
-- ===========================================================================

-- profiles
create policy profiles_ler_proprio_ou_admin on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.eh_admin_plataforma()));

create policy profiles_gestor_ver_pessoas_do_condominio on public.profiles
  for select to authenticated
  using (
    exists (
      select 1 from public.vinculos v
      where v.usuario_id = profiles.id and public.eh_gestor_aprovado(v.condominio_id)
    )
    or exists (
      select 1 from public.solicitacoes_vinculo s
      where s.solicitante_id = profiles.id and public.eh_gestor_aprovado(s.condominio_id)
    )
  );

-- O usuário altera só o próprio nome (o GRANT da seção 6 limita a coluna).
create policy profiles_atualizar_proprio_nome on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- administradores_plataforma
create policy administradores_ler_proprio_registro on public.administradores_plataforma
  for select to authenticated
  using (usuario_id = (select auth.uid()));

-- condominios
create policy condominios_listagem_para_cadastro on public.condominios
  for select to anon, authenticated
  using (public.condominio_aceita_cadastro(id));

create policy condominios_ler_admin on public.condominios
  for select to authenticated
  using ((select public.eh_admin_plataforma()));

-- imoveis: o próprio morador (vínculo vigente), o gestor do condomínio ou o admin
create policy imoveis_ler_proprio_gestor_ou_admin on public.imoveis
  for select to authenticated
  using (
    exists (
      select 1
      from public.vinculos_imovel vi
      join public.vinculos v on v.id = vi.vinculo_id
      where vi.imovel_id = imoveis.id
        and v.usuario_id = (select auth.uid())
        and v.status = 'ativo'
        and v.inicio_vigencia <= current_date
        and (v.fim_vigencia is null or v.fim_vigencia >= current_date)
    )
    or public.eh_gestor_aprovado(condominio_id)
    or (select public.eh_admin_plataforma())
  );

-- vinculos: o próprio usuário vê também os encerrados (histórico)
create policy vinculos_ler_proprio_gestor_ou_admin on public.vinculos
  for select to authenticated
  using (
    usuario_id = (select auth.uid())
    or public.eh_gestor_aprovado(condominio_id)
    or (select public.eh_admin_plataforma())
  );

create policy vinculos_imovel_ler_proprio_gestor_ou_admin on public.vinculos_imovel
  for select to authenticated
  using (
    exists (
      select 1 from public.vinculos v
      where v.id = vinculos_imovel.vinculo_id
        and v.usuario_id = (select auth.uid())
        and v.status = 'ativo'
        and v.inicio_vigencia <= current_date
        and (v.fim_vigencia is null or v.fim_vigencia >= current_date)
    )
    or public.eh_gestor_aprovado(condominio_id)
    or (select public.eh_admin_plataforma())
  );

-- solicitacoes_condominio: o gestor abre o pedido; a análise é só pelas funções da seção 5
create policy solicitacoes_condominio_ler_proprio_ou_admin on public.solicitacoes_condominio
  for select to authenticated
  using (solicitante_id = (select auth.uid()) or (select public.eh_admin_plataforma()));

create policy solicitacoes_condominio_criar_proprio_pendente on public.solicitacoes_condominio
  for insert to authenticated
  with check (
    solicitante_id = (select auth.uid())
    and status = 'pendente'
    and analisado_por is null
    and analisado_em is null
    and condominio_criado_id is null
    and vinculo_gestor_id is null
  );

-- solicitacoes_vinculo: criadas pelo cadastro (trigger); análise só pelas funções da seção 5
create policy solicitacoes_vinculo_ler_proprio_gestor_ou_admin on public.solicitacoes_vinculo
  for select to authenticated
  using (
    solicitante_id = (select auth.uid())
    or public.eh_gestor_aprovado(condominio_id)
    or (select public.eh_admin_plataforma())
  );

-- documentos_comprobatorios
create policy documentos_comprobatorios_ler_pedido_autorizado on public.documentos_comprobatorios
  for select to authenticated
  using (
    (select public.eh_admin_plataforma())
    or exists (
      select 1 from public.solicitacoes_condominio sc
      where sc.id = documentos_comprobatorios.solicitacao_condominio_id
        and sc.solicitante_id = (select auth.uid())
    )
    or exists (
      select 1 from public.solicitacoes_vinculo sv
      where sv.id = documentos_comprobatorios.solicitacao_vinculo_id
        and (sv.solicitante_id = (select auth.uid()) or public.eh_gestor_aprovado(sv.condominio_id))
    )
  );

-- Registro do documento: só na própria pasta do bucket e só em solicitação própria pendente.
create policy documentos_comprobatorios_registrar_proprio on public.documentos_comprobatorios
  for insert to authenticated
  with check (
    storage_path like (select auth.uid())::text || '/%'
    and (
      exists (
        select 1 from public.solicitacoes_condominio sc
        where sc.id = solicitacao_condominio_id
          and sc.solicitante_id = (select auth.uid())
          and sc.status = 'pendente'
      )
      or exists (
        select 1 from public.solicitacoes_vinculo sv
        where sv.id = solicitacao_vinculo_id
          and sv.solicitante_id = (select auth.uid())
          and sv.status = 'pendente'
      )
    )
  );

-- ocorrencias e tabelas ligadas: quem registrou, o gestor do condomínio ou o admin.
-- As políticas de escrita entram com as histórias de registro e tratamento de ocorrências.
create policy ocorrencias_ler_registrante_gestor_ou_admin on public.ocorrencias
  for select to authenticated
  using (
    registrado_por = (select auth.uid())
    or public.eh_gestor_aprovado(condominio_id)
    or (select public.eh_admin_plataforma())
  );

create policy anexos_ler_ocorrencia_autorizada on public.anexos
  for select to authenticated
  using (exists (
    select 1 from public.ocorrencias o
    where o.id = anexos.ocorrencia_id
      and (o.registrado_por = (select auth.uid())
           or public.eh_gestor_aprovado(o.condominio_id)
           or (select public.eh_admin_plataforma()))
  ));

create policy classificacoes_ia_ler_ocorrencia_autorizada on public.classificacoes_ia
  for select to authenticated
  using (exists (
    select 1 from public.ocorrencias o
    where o.id = classificacoes_ia.ocorrencia_id
      and (o.registrado_por = (select auth.uid())
           or public.eh_gestor_aprovado(o.condominio_id)
           or (select public.eh_admin_plataforma()))
  ));

create policy decisoes_ler_ocorrencia_autorizada on public.decisoes
  for select to authenticated
  using (exists (
    select 1 from public.ocorrencias o
    where o.id = decisoes.ocorrencia_id
      and (o.registrado_por = (select auth.uid())
           or public.eh_gestor_aprovado(o.condominio_id)
           or (select public.eh_admin_plataforma()))
  ));

create policy historico_status_ler_ocorrencia_autorizada on public.historico_status
  for select to authenticated
  using (exists (
    select 1 from public.ocorrencias o
    where o.id = historico_status.ocorrencia_id
      and (o.registrado_por = (select auth.uid())
           or public.eh_gestor_aprovado(o.condominio_id)
           or (select public.eh_admin_plataforma()))
  ));

-- ===========================================================================
-- 5. Funções de cadastro, aprovação, recusa e encerramento
--    Chamadas pelo front com supabase.rpc(...). Ninguém analisa o próprio pedido.
-- ===========================================================================

-- Sprint 1: o gestor cadastra o condomínio e já começa a usar (vínculo nasce ativo).
-- Quando a análise do admin entrar, o cadastro passa por solicitacoes_condominio
-- e aprovar_solicitacao_condominio, que já estão prontas abaixo.
create or replace function public.cadastrar_condominio(p_nome text, p_cnpj text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_nome text := nullif(pg_catalog.btrim(coalesce(p_nome, '')), '');
  v_cnpj text := pg_catalog.regexp_replace(coalesce(p_cnpj, ''), '[^0-9]', '', 'g');
  v_condominio_id uuid;
begin
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'gestor') then
    raise exception using errcode = '42501', message = 'Apenas gestores podem cadastrar condomínios.';
  end if;
  if v_nome is null then
    raise exception using errcode = '22023', message = 'Informe o nome do condomínio.';
  end if;
  if pg_catalog.length(v_cnpj) <> 14 then
    raise exception using errcode = '22023', message = 'Informe um CNPJ com 14 dígitos.';
  end if;
  if exists (select 1 from public.condominios c where c.cnpj = v_cnpj) then
    raise exception using errcode = '23505', message = 'Já existe um condomínio cadastrado com este CNPJ.';
  end if;

  insert into public.condominios (nome, cnpj, criado_por)
  values (v_nome, v_cnpj, v_uid)
  returning id into v_condominio_id;

  insert into public.vinculos (usuario_id, condominio_id, tipo, status, aprovado_por, aprovado_em)
  values (v_uid, v_condominio_id, 'gestor', 'ativo', v_uid, now());

  return v_condominio_id;
end;
$$;

-- Admin aprova o pedido: cria o condomínio e o vínculo ativo do gestor.
-- Sem tela de admin, chame pelo SQL Editor do Studio com "impersonate" da própria conta.
create or replace function public.aprovar_solicitacao_condominio(p_solicitacao_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sol public.solicitacoes_condominio%rowtype;
  v_condominio_id uuid;
  v_vinculo_id uuid;
begin
  if not public.eh_admin_plataforma() then
    raise exception using errcode = '42501', message = 'Apenas administradores podem aprovar condomínios.';
  end if;

  select * into v_sol from public.solicitacoes_condominio where id = p_solicitacao_id for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Solicitação não encontrada.';
  end if;
  if v_sol.status <> 'pendente' then
    raise exception using errcode = '22023', message = 'A solicitação já foi analisada.';
  end if;
  if v_sol.solicitante_id = v_uid then
    raise exception using errcode = '42501', message = 'Não é permitido aprovar a própria solicitação.';
  end if;

  insert into public.condominios (nome, cnpj, criado_por)
  values (v_sol.nome_condominio, v_sol.cnpj, v_sol.solicitante_id)
  returning id into v_condominio_id;

  insert into public.vinculos (usuario_id, condominio_id, tipo, status, aprovado_por, aprovado_em)
  values (v_sol.solicitante_id, v_condominio_id, 'gestor', 'ativo', v_uid, now())
  returning id into v_vinculo_id;

  update public.solicitacoes_condominio
  set status = 'aprovada',
      analisado_por = v_uid,
      analisado_em = now(),
      condominio_criado_id = v_condominio_id,
      vinculo_gestor_id = v_vinculo_id
  where id = p_solicitacao_id;

  return v_condominio_id;
end;
$$;

create or replace function public.recusar_solicitacao_condominio(p_solicitacao_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sol public.solicitacoes_condominio%rowtype;
begin
  if not public.eh_admin_plataforma() then
    raise exception using errcode = '42501', message = 'Apenas administradores podem recusar condomínios.';
  end if;
  if nullif(pg_catalog.btrim(coalesce(p_motivo, '')), '') is null then
    raise exception using errcode = '22023', message = 'Informe o motivo da recusa.';
  end if;

  select * into v_sol from public.solicitacoes_condominio where id = p_solicitacao_id for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Solicitação não encontrada.';
  end if;
  if v_sol.status <> 'pendente' then
    raise exception using errcode = '22023', message = 'A solicitação já foi analisada.';
  end if;
  if v_sol.solicitante_id = v_uid then
    raise exception using errcode = '42501', message = 'Não é permitido recusar a própria solicitação.';
  end if;

  update public.solicitacoes_condominio
  set status = 'recusada',
      analisado_por = v_uid,
      analisado_em = now(),
      motivo_recusa = pg_catalog.btrim(p_motivo)
  where id = p_solicitacao_id;
end;
$$;

-- Gestor do condomínio aprova o pedido de vínculo: garante o imóvel e o vínculo ativo.
-- Se a pessoa já tem vínculo ativo do mesmo tipo (ex.: segundo imóvel), ele é reaproveitado.
create or replace function public.aprovar_solicitacao_vinculo(p_solicitacao_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sol public.solicitacoes_vinculo%rowtype;
  v_imovel_id uuid;
  v_vinculo_id uuid;
  v_vinculo_novo boolean := false;
begin
  select * into v_sol from public.solicitacoes_vinculo where id = p_solicitacao_id for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Solicitação não encontrada.';
  end if;
  if not public.eh_gestor_aprovado(v_sol.condominio_id) then
    raise exception using errcode = '42501', message = 'Apenas o gestor do condomínio pode aprovar esta solicitação.';
  end if;
  if v_sol.status <> 'pendente' then
    raise exception using errcode = '22023', message = 'A solicitação já foi analisada.';
  end if;
  if v_sol.solicitante_id = v_uid then
    raise exception using errcode = '42501', message = 'Não é permitido aprovar a própria solicitação.';
  end if;

  if v_sol.tipo_solicitado = 'morador' then
    v_imovel_id := v_sol.imovel_id;

    if v_imovel_id is null then
      insert into public.imoveis (condominio_id, bloco, unidade)
      values (v_sol.condominio_id, v_sol.bloco_solicitado, pg_catalog.btrim(v_sol.unidade_solicitada))
      on conflict (condominio_id, bloco, unidade) do nothing
      returning id into v_imovel_id;

      if v_imovel_id is null then
        select i.id into v_imovel_id
        from public.imoveis i
        where i.condominio_id = v_sol.condominio_id
          and i.bloco = v_sol.bloco_solicitado
          and i.unidade = pg_catalog.btrim(v_sol.unidade_solicitada);
      end if;
    end if;
  end if;

  select v.id into v_vinculo_id
  from public.vinculos v
  where v.usuario_id = v_sol.solicitante_id
    and v.condominio_id = v_sol.condominio_id
    and v.tipo = v_sol.tipo_solicitado
    and v.status = 'ativo';

  if v_vinculo_id is null then
    insert into public.vinculos (usuario_id, condominio_id, tipo, status, aprovado_por, aprovado_em)
    values (v_sol.solicitante_id, v_sol.condominio_id, v_sol.tipo_solicitado, 'ativo', v_uid, now())
    returning id into v_vinculo_id;
    v_vinculo_novo := true;
  end if;

  if v_imovel_id is not null then
    insert into public.vinculos_imovel (vinculo_id, imovel_id, condominio_id)
    values (v_vinculo_id, v_imovel_id, v_sol.condominio_id)
    on conflict (vinculo_id, imovel_id) do nothing;
  end if;

  -- vinculo_aprovado_id é único: só é preenchido quando esta solicitação criou o vínculo.
  update public.solicitacoes_vinculo
  set status = 'aprovada',
      analisado_por = v_uid,
      analisado_em = now(),
      imovel_id = coalesce(v_imovel_id, imovel_id),
      vinculo_aprovado_id = case when v_vinculo_novo then v_vinculo_id else null end
  where id = p_solicitacao_id;

  return v_vinculo_id;
end;
$$;

create or replace function public.recusar_solicitacao_vinculo(p_solicitacao_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sol public.solicitacoes_vinculo%rowtype;
begin
  if nullif(pg_catalog.btrim(coalesce(p_motivo, '')), '') is null then
    raise exception using errcode = '22023', message = 'Informe o motivo da recusa.';
  end if;

  select * into v_sol from public.solicitacoes_vinculo where id = p_solicitacao_id for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Solicitação não encontrada.';
  end if;
  if not public.eh_gestor_aprovado(v_sol.condominio_id) then
    raise exception using errcode = '42501', message = 'Apenas o gestor do condomínio pode recusar esta solicitação.';
  end if;
  if v_sol.status <> 'pendente' then
    raise exception using errcode = '22023', message = 'A solicitação já foi analisada.';
  end if;
  if v_sol.solicitante_id = v_uid then
    raise exception using errcode = '42501', message = 'Não é permitido recusar a própria solicitação.';
  end if;

  update public.solicitacoes_vinculo
  set status = 'recusada',
      analisado_por = v_uid,
      analisado_em = now(),
      motivo_recusa = pg_catalog.btrim(p_motivo)
  where id = p_solicitacao_id;
end;
$$;

-- Encerra um vínculo. Gestor: só o admin. Morador ou funcionário: o gestor do condomínio ou o admin.
-- O vínculo e o histórico permanecem; o acesso termina na hora.
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

-- ===========================================================================
-- 6. Permissões dos papéis da API
--    Tudo começa fechado e só o necessário é liberado; o RLS filtra as linhas.
-- ===========================================================================

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- Leitura (as políticas da seção 4 decidem quais linhas)
grant select on
  public.profiles,
  public.administradores_plataforma,
  public.condominios,
  public.imoveis,
  public.vinculos,
  public.vinculos_imovel,
  public.solicitacoes_condominio,
  public.solicitacoes_vinculo,
  public.documentos_comprobatorios,
  public.ocorrencias,
  public.anexos,
  public.classificacoes_ia,
  public.decisoes,
  public.historico_status
to authenticated;

-- Lista pública de condomínios no cadastro: só id e nome (o front usa .select('id, nome')).
grant select (id, nome) on public.condominios to anon;

-- Escritas liberadas ao front, sempre por coluna
grant update (nome) on public.profiles to authenticated;
grant insert (solicitante_id, nome_condominio, cnpj) on public.solicitacoes_condominio to authenticated;
grant insert (solicitacao_condominio_id, solicitacao_vinculo_id, storage_path, nome_original, tipo_mime, tamanho_bytes)
  on public.documentos_comprobatorios to authenticated;

-- Funções usadas pelas políticas (precisam de execute para o RLS funcionar)
grant execute on function public.eh_admin_plataforma() to authenticated;
grant execute on function public.eh_gestor_aprovado(uuid) to authenticated;
grant execute on function public.condominio_aceita_cadastro(uuid) to anon, authenticated;

-- Funções chamadas pelo front
grant execute on function public.cadastrar_condominio(text, text) to authenticated;
grant execute on function public.aprovar_solicitacao_condominio(uuid) to authenticated;
grant execute on function public.recusar_solicitacao_condominio(uuid, text) to authenticated;
grant execute on function public.aprovar_solicitacao_vinculo(uuid) to authenticated;
grant execute on function public.recusar_solicitacao_vinculo(uuid, text) to authenticated;
grant execute on function public.encerrar_vinculo(uuid, text) to authenticated;

-- handle_new_user e definir_papel_admin são funções de trigger: ninguém chama pela API.

-- ===========================================================================
-- 7. Storage: documentos comprobatórios
--    Caminho no bucket: <uid do solicitante>/<nome-único-do-arquivo>
--    O mesmo caminho vai em documentos_comprobatorios.storage_path.
--    Documentos são evidência: sem update nem delete.
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos',
  'documentos',
  false,
  10485760, -- 10 MB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy documentos_upload_propria_pasta on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Leitura: o dono da pasta, ou quem pode ver o registro em documentos_comprobatorios
-- (a subconsulta respeita o RLS daquela tabela: solicitante, gestor do condomínio ou admin).
create policy documentos_ler_autorizado on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documentos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.documentos_comprobatorios d
        where d.storage_path = storage.objects.name
      )
    )
  );
