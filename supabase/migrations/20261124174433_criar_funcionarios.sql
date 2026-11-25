-- Funcionários do condomínio (SQUAD1-69, história SQUAD1-52).
-- O funcionário é um contato cadastrado pelo gestor, sem conta nem login (decisão do Lucas em
-- 23/11): não usa vinculos nem o tipo 'funcionario' de lá. Serve para a delegação da US 3.
-- Leitura só para o gestor ativo do condomínio; escrita só pelas funções abaixo (regra 5).

create table public.funcionarios (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id),
  nome text not null
    constraint funcionarios_nome_valido
    check (nome = pg_catalog.btrim(nome) and pg_catalog.char_length(nome) between 1 and 120),
  -- Só dígitos, no formato do WhatsApp: 55 + DDD + 9 dígitos (ex.: 5511999998888).
  celular text not null
    constraint funcionarios_celular_valido
    check (celular ~ '^55[1-9]{2}9[0-9]{8}$'),
  -- Texto livre: o front oferece Zelador, Porteiro, Auxiliar de limpeza ou "Outra".
  funcao text not null
    constraint funcionarios_funcao_valida
    check (funcao = pg_catalog.btrim(funcao) and pg_catalog.char_length(funcao) between 1 and 60),
  ativo boolean not null default true,
  criado_por uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.funcionarios enable row level security;

create index funcionarios_condominio_id_idx on public.funcionarios (condominio_id);
create index funcionarios_criado_por_idx on public.funcionarios (criado_por);

-- Celular único por condomínio só entre os ativos: quem foi desativado pode ser cadastrado de
-- novo, e o mesmo celular pode estar em outro condomínio (um zelador de dois prédios).
create unique index funcionarios_celular_ativo_por_condominio
  on public.funcionarios (condominio_id, celular)
  where ativo;

comment on table public.funcionarios is
  'Contatos dos funcionários de cada condomínio (sem conta), cadastrados pelo gestor para a delegação.';

-- Leitura: só o gestor ativo e vigente do condomínio. Morador, anon e admin não leem.
create policy funcionarios_ler_gestor on public.funcionarios
  for select
  to authenticated
  using (public.eh_gestor_aprovado(condominio_id));

-- Sem políticas de insert, update ou delete: a escrita é só pelas funções abaixo.

-- Cadastra um funcionário num condomínio em que quem chama é gestor ativo.
create or replace function public.cadastrar_funcionario(
  p_condominio_id uuid,
  p_nome text,
  p_celular text,
  p_funcao text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_nome text := pg_catalog.btrim(coalesce(p_nome, ''));
  v_celular text := pg_catalog.btrim(coalesce(p_celular, ''));
  v_funcao text := pg_catalog.btrim(coalesce(p_funcao, ''));
  v_id uuid;
  v_restricao text;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'Entre na sua conta para cadastrar um funcionário.';
  end if;
  if p_condominio_id is null then
    raise exception using errcode = '22023', message = 'Escolha o condomínio do funcionário.';
  end if;
  if not public.eh_gestor_aprovado(p_condominio_id) then
    raise exception using errcode = '42501', message = 'Você não é gestor deste condomínio.';
  end if;
  if v_nome = '' then
    raise exception using errcode = '22023', message = 'Informe o nome do funcionário.';
  end if;
  if pg_catalog.char_length(v_nome) > 120 then
    raise exception using errcode = '22023', message = 'O nome pode ter no máximo 120 caracteres.';
  end if;
  if v_celular !~ '^55[1-9]{2}9[0-9]{8}$' then
    raise exception using errcode = '22023',
      message = 'Celular inválido: use DDD + 9 dígitos, só números, com o 55 na frente (ex.: 5511999998888).';
  end if;
  if v_funcao = '' then
    raise exception using errcode = '22023', message = 'Informe a função do funcionário.';
  end if;
  if pg_catalog.char_length(v_funcao) > 60 then
    raise exception using errcode = '22023', message = 'A função pode ter no máximo 60 caracteres.';
  end if;

  begin
    insert into public.funcionarios (condominio_id, nome, celular, funcao, criado_por)
    values (p_condominio_id, v_nome, v_celular, v_funcao, v_uid)
    returning id into v_id;
  exception when unique_violation then
    get stacked diagnostics v_restricao = constraint_name;
    if v_restricao = 'funcionarios_celular_ativo_por_condominio' then
      raise exception using errcode = '23505',
        message = 'Já existe um funcionário ativo com este celular neste condomínio.';
    end if;
    raise;
  end;

  return v_id;
end;
$$;

comment on function public.cadastrar_funcionario(uuid, text, text, text) is
  'Gestor ativo do condomínio cadastra um funcionário (contato sem conta). Celular único entre os ativos do condomínio.';

-- Desativa um funcionário. Repetir não muda nada. Tarefas já delegadas a ele não são afetadas.
create or replace function public.desativar_funcionario(p_funcionario_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_condominio_id uuid;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'Entre na sua conta para desativar um funcionário.';
  end if;

  select f.condominio_id into v_condominio_id
  from public.funcionarios f
  where f.id = p_funcionario_id;

  -- Mesma mensagem para id inexistente e para condomínio alheio: quem não é gestor do
  -- condomínio não descobre se o id existe.
  if v_condominio_id is null or not public.eh_gestor_aprovado(v_condominio_id) then
    raise exception using errcode = '42501',
      message = 'Funcionário não encontrado ou você não é gestor deste condomínio.';
  end if;

  update public.funcionarios
  set ativo = false
  where id = p_funcionario_id
    and ativo;
end;
$$;

comment on function public.desativar_funcionario(uuid) is
  'Gestor ativo do condomínio desativa um funcionário (some da delegação, continua na lista). Idempotente.';

-- Permissões. As migrações anteriores fecham tabelas e funções novas para todos; aqui libera
-- só o necessário para quem está logado. A política decide quais linhas cada um lê.
revoke all on public.funcionarios from anon, authenticated;
grant select on public.funcionarios to authenticated;

revoke execute on function public.cadastrar_funcionario(uuid, text, text, text) from public, anon;
revoke execute on function public.desativar_funcionario(uuid) from public, anon;
grant execute on function public.cadastrar_funcionario(uuid, text, text, text) to authenticated;
grant execute on function public.desativar_funcionario(uuid) to authenticated;
