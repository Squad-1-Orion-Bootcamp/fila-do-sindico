-- O morador não vê a prioridade nem o motivo da IA, só o status (decisão do Lucas, SQUAD1-56).
-- Com a SQUAD1-59 esses dados passam a ser preenchidos, então a regra vale no banco, não só na
-- tela: o morador não consegue ler pela API.
--
-- Gestor e morador usam o mesmo papel (authenticated), e permissão por coluna vale para o papel
-- todo. Por isso o painel do gestor passa a ler a lista pela função listar_ocorrencias_gestor.

-- ---------------------------------------------------------------------------
-- 1. Classificações da IA e decisões do gestor: só gestor ativo do condomínio e admin leem
-- ---------------------------------------------------------------------------
alter policy classificacoes_ia_ler_ocorrencia_autorizada on public.classificacoes_ia
  using (exists (
    select 1 from public.ocorrencias o
    where o.id = classificacoes_ia.ocorrencia_id
      and (public.eh_gestor_aprovado(o.condominio_id)
           or (select public.eh_admin_plataforma()))
  ));

-- Decisões do gestor (prioridade escolhida, justificativa, notas): também só gestor ativo e
-- admin. Responde a SQUAD1-49 pela regra "o morador vê só o status" (SQUAD1-56 e US 3).
alter policy decisoes_ler_ocorrencia_autorizada on public.decisoes
  using (exists (
    select 1 from public.ocorrencias o
    where o.id = decisoes.ocorrencia_id
      and (public.eh_gestor_aprovado(o.condominio_id)
           or (select public.eh_admin_plataforma()))
  ));

-- ---------------------------------------------------------------------------
-- 2. ocorrencias: urgencia_atual e categoria_atual fora da leitura direta
-- ---------------------------------------------------------------------------
-- As políticas continuam decidindo quais linhas; aqui muda só quais colunas.
revoke select on public.ocorrencias from authenticated;
grant select (
  id, condominio_id, registrado_por, imovel_id, local, descricao, status,
  created_at, updated_at, concluido_em, origem, relatado_por
) on public.ocorrencias to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Lista do painel do gestor, com a prioridade
-- ---------------------------------------------------------------------------
-- Ocorrências de todos os condomínios em que quem chama é gestor ativo e vigente, das mais
-- novas para as mais antigas. Quem não é gestor ativo recebe a lista vazia.
create or replace function public.listar_ocorrencias_gestor()
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
  registrado_por_nome text
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.condominio_id, c.nome, o.local, o.descricao, o.status,
         o.urgencia_atual, o.categoria_atual, o.created_at, p.nome
  from public.ocorrencias o
  join public.condominios c on c.id = o.condominio_id
  left join public.profiles p on p.id = o.registrado_por
  where (select auth.uid()) is not null
    and public.eh_gestor_aprovado(o.condominio_id)
  order by o.created_at desc;
$$;

comment on function public.listar_ocorrencias_gestor() is
  'Painel do gestor: ocorrências dos condomínios em que ele é gestor ativo, com urgência e categoria.';

revoke execute on function public.listar_ocorrencias_gestor() from public, anon;
grant execute on function public.listar_ocorrencias_gestor() to authenticated;
