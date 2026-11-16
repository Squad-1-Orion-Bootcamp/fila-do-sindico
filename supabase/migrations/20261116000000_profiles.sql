-- Perfil de cada usuário do Supabase Auth.
-- Ponto de partida: o modelo de dados completo (condomínios, moradores, ocorrências)
-- vem nas próximas migrações.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('sindico', 'morador')),
  nome text,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Perfil de acesso. O papel fica aqui, e não em user_metadata, porque o usuário consegue alterar user_metadata pelo navegador.';

alter table public.profiles enable row level security;

-- Cada usuário lê só o próprio perfil.
create policy "usuario le o proprio perfil"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

-- Não há política de insert/update/delete: só o time (pelo painel ou por migração/seed)
-- define quem é síndico. O usuário não consegue se promover pelo front.
