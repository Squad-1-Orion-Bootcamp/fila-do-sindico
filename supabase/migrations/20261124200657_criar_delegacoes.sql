-- Delegações de ocorrências para funcionários (SQUAD1-73, história SQUAD1-54, US 3).
-- O gestor delega pelo próprio WhatsApp; o funcionário abre um link público (sem login) e
-- conclui a tarefa. A escrita é só por funções: as do gestor (SQUAD1-74) e as do link
-- (SQUAD1-75). Decisões do link em docs/decisoes.md (SQUAD1-72).
--
-- O banco guarda só o hash do token (decisão de 24/11): a função de delegar devolve o token
-- uma vez, para o link do WhatsApp. Se a tabela vazar, nenhum link funciona.

-- Chave (id, condominio_id) em funcionarios para a FK composta abaixo: garante no banco que o
-- funcionário é do mesmo condomínio da ocorrência.
alter table public.funcionarios
  add constraint funcionarios_id_condominio_key unique (id, condominio_id);

create table public.delegacoes (
  id uuid primary key default gen_random_uuid(),
  ocorrencia_id uuid not null,
  condominio_id uuid not null,
  funcionario_id uuid not null,
  -- SHA-256 do token do link (32 bytes). O token puro nunca é gravado.
  token_hash bytea not null unique
    constraint delegacoes_token_hash_tamanho check (pg_catalog.octet_length(token_hash) = 32),
  situacao text not null default 'ativa'
    constraint delegacoes_situacao_valida check (situacao in ('ativa', 'concluida', 'revogada')),
  -- Comentário do funcionário ao concluir. Só o gestor vê (decisão do Lucas, SQUAD1-72).
  comentario text
    constraint delegacoes_comentario_tamanho check (comentario is null or pg_catalog.char_length(comentario) <= 800),
  criado_por uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  concluida_em timestamptz,
  revogada_em timestamptz,
  foreign key (ocorrencia_id, condominio_id) references public.ocorrencias (id, condominio_id),
  foreign key (funcionario_id, condominio_id) references public.funcionarios (id, condominio_id),
  -- As datas acompanham a situação.
  constraint delegacoes_datas_da_situacao check (
    (situacao = 'ativa' and concluida_em is null and revogada_em is null)
    or (situacao = 'concluida' and concluida_em is not null and revogada_em is null)
    or (situacao = 'revogada' and revogada_em is not null and concluida_em is null)
  ),
  constraint delegacoes_comentario_so_na_conclusao check (comentario is null or situacao = 'concluida')
);

alter table public.delegacoes enable row level security;

-- Só uma delegação ativa por ocorrência: trocar o responsável revoga a anterior (SQUAD1-74).
create unique index delegacoes_uma_ativa_por_ocorrencia
  on public.delegacoes (ocorrencia_id)
  where situacao = 'ativa';

create index delegacoes_ocorrencia_id_idx on public.delegacoes (ocorrencia_id);
create index delegacoes_condominio_id_idx on public.delegacoes (condominio_id);
create index delegacoes_funcionario_id_idx on public.delegacoes (funcionario_id);
create index delegacoes_criado_por_idx on public.delegacoes (criado_por);

comment on table public.delegacoes is
  'Ocorrências delegadas a funcionários pelo link público. Guarda só o hash do token.';

-- Leitura: só o gestor ativo e vigente do condomínio. Morador, admin e visitante não leem; a
-- página pública do link usa só as funções da SQUAD1-75.
create policy delegacoes_ler_gestor on public.delegacoes
  for select
  to authenticated
  using (public.eh_gestor_aprovado(condominio_id));

-- Sem políticas de insert, update ou delete: a escrita é só por funções.

-- Permissões. Nada para anon; para quem está logado, todas as colunas menos o hash do token.
revoke all on public.delegacoes from anon, authenticated;
grant select (
  id, ocorrencia_id, condominio_id, funcionario_id, situacao, comentario, criado_por,
  created_at, concluida_em, revogada_em
) on public.delegacoes to authenticated;
