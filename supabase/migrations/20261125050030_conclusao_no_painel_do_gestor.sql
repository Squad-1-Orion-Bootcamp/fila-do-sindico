-- Painel do gestor (SQUAD1-61): a coluna Concluído mostra primeiro as concluídas mais
-- recentemente. Para isso, listar_ocorrencias_gestor passa a devolver também concluido_em.
--
-- A coluna já existe e é mantida por alterar_status_ocorrencia, delegar_ocorrencia e
-- concluir_tarefa. Ela já fazia parte da leitura direta de ocorrencias por authenticated
-- (migração 20261124041425), então o gestor não passa a ver nada que não via.
--
-- Mudar as colunas de retorno exige recriar a função; o corpo, o filtro e as permissões são
-- os mesmos da migração 20261124041425.

drop function public.listar_ocorrencias_gestor();

create function public.listar_ocorrencias_gestor()
returns table (
  id uuid,
  condominio_id uuid,
  condominio_nome text,
  local text,
  descricao text,
  status text,
  urgencia_atual text,
  categoria_atual text,
  created_at timestamptz,
  registrado_por_nome text,
  concluido_em timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.condominio_id, c.nome, o.local, o.descricao, o.status,
         o.urgencia_atual, o.categoria_atual, o.created_at, p.nome, o.concluido_em
  from public.ocorrencias o
  join public.condominios c on c.id = o.condominio_id
  left join public.profiles p on p.id = o.registrado_por
  where (select auth.uid()) is not null
    and public.eh_gestor_aprovado(o.condominio_id)
  order by o.created_at desc;
$$;

comment on function public.listar_ocorrencias_gestor() is
  'Painel do gestor: ocorrências dos condomínios em que ele é gestor ativo, com urgência, categoria e data de conclusão.';

revoke execute on function public.listar_ocorrencias_gestor() from public, anon;
grant execute on function public.listar_ocorrencias_gestor() to authenticated;
