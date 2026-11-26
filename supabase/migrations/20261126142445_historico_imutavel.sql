-- Histórico imutável em decisoes, historico_status e classificacoes_ia (SQUAD1-91).
-- As três tabelas são o registro de quem decidiu o quê: a classificação da IA, a prioridade
-- definida pelo gestor e as trocas de status. O RLS já impede o front de alterar, mas a chave
-- secreta (service_role, usada pelo ai-service) e o postgres passam por cima do RLS. Estes
-- gatilhos recusam UPDATE, DELETE e TRUNCATE para qualquer papel: as tabelas são só de inserção.
-- Decisão em docs/decisoes/2026-11-26-squad1-91-historico-imutavel.md.
--
-- Uma migração que precise mesmo corrigir dados nelas desativa o gatilho só dentro dela
-- (alter table ... disable trigger ... e depois enable) e explica o motivo.

create or replace function private.recusar_alteracao_do_historico()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '42501',
    message = 'O histórico não pode ser alterado nem apagado.',
    detail = pg_catalog.format('Tabela %I.%I: só aceita inserção (SQUAD1-91).', TG_TABLE_SCHEMA, TG_TABLE_NAME);
end;
$$;

comment on function private.recusar_alteracao_do_historico() is
  'Gatilho que recusa UPDATE, DELETE e TRUNCATE nas tabelas de histórico (SQUAD1-91).';

-- Só roda pelo gatilho.
revoke execute on function private.recusar_alteracao_do_historico() from public, anon, authenticated;

create trigger classificacoes_ia_so_insercao
  before update or delete on public.classificacoes_ia
  for each row execute function private.recusar_alteracao_do_historico();

create trigger classificacoes_ia_sem_truncate
  before truncate on public.classificacoes_ia
  for each statement execute function private.recusar_alteracao_do_historico();

create trigger decisoes_so_insercao
  before update or delete on public.decisoes
  for each row execute function private.recusar_alteracao_do_historico();

create trigger decisoes_sem_truncate
  before truncate on public.decisoes
  for each statement execute function private.recusar_alteracao_do_historico();

create trigger historico_status_so_insercao
  before update or delete on public.historico_status
  for each row execute function private.recusar_alteracao_do_historico();

create trigger historico_status_sem_truncate
  before truncate on public.historico_status
  for each statement execute function private.recusar_alteracao_do_historico();

-- "always": os gatilhos disparam também com session_replication_role = replica, que o postgres
-- pode ligar para pular gatilhos comuns. Assim, só um disable trigger explícito (de quem é dono
-- da tabela, numa migração) passa por cima.
alter table public.classificacoes_ia
  enable always trigger classificacoes_ia_so_insercao,
  enable always trigger classificacoes_ia_sem_truncate;
alter table public.decisoes
  enable always trigger decisoes_so_insercao,
  enable always trigger decisoes_sem_truncate;
alter table public.historico_status
  enable always trigger historico_status_so_insercao,
  enable always trigger historico_status_sem_truncate;
