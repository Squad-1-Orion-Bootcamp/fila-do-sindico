-- Perfil de cada usuário do Supabase Auth.
-- O restante do modelo de dados (condomínios, vínculos, solicitações, ocorrências) e as
-- políticas de acesso desta tabela estão em 20261118033000_modelo_de_dados.sql.
--
-- Esta migração foi editada uma única vez (18/11) para trocar os papéis `sindico`/`morador`
-- por `admin`/`gestor`/`morador`, como previsto em supabase/AGENTS.md. Ela ainda não tinha sido
-- aplicada em nenhum ambiente compartilhado. A partir daqui, vale a regra de nunca editá-la.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'gestor', 'morador')),
  nome text not null check (btrim(nome) <> ''),
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Perfil de acesso. O papel fica aqui, e não em user_metadata, porque o usuário consegue alterar user_metadata pelo navegador.';
comment on column public.profiles.role is
  'Gravado pelo banco: gestor ou morador no cadastro (trigger handle_new_user) e admin quando a conta entra em administradores_plataforma. O usuário não consegue alterar.';

alter table public.profiles enable row level security;
