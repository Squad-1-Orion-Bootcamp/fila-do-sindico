-- Funções públicas do link de delegação (SQUAD1-75, história SQUAD1-54).
-- O visitante recebe somente os dados necessários para executar a tarefa. O token puro não é
-- armazenado: a comparação usa o hash SHA-256 já guardado em delegacoes.

-- ---------------------------------------------------------------------------
-- 1. Consultar tarefa pelo link (o preview do WhatsApp pode chamar esta função)
-- ---------------------------------------------------------------------------
-- Token inexistente, revogado, concluído ou fora de uma ocorrência ainda delegada resulta na
-- mesma resposta: nenhuma linha. Esta função não altera dados.
create or replace function public.ver_tarefa(p_token text)
returns table (
  nome_condominio text,
  local text,
  descricao text,
  situacao text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.nome, o.local, o.descricao, d.situacao
  from public.delegacoes d
  join public.ocorrencias o
    on o.id = d.ocorrencia_id and o.condominio_id = d.condominio_id
  join public.condominios c on c.id = d.condominio_id
  where p_token is not null
    and pg_catalog.char_length(p_token) = 43
    and pg_catalog.octet_length(p_token) = 43
    and p_token ~ '^[A-Za-z0-9_-]{43}$'
    and d.token_hash = extensions.digest(p_token, 'sha256')
    and d.situacao = 'ativa'
    and o.status = 'delegado';
$$;

comment on function public.ver_tarefa(text) is
  'Devolve nome do condomínio, local, descrição e situação somente para um token de delegação ativo.';

-- ---------------------------------------------------------------------------
-- 2. Concluir tarefa pelo link
-- ---------------------------------------------------------------------------
-- Primeiro trava a ocorrência, na mesma ordem de delegar_ocorrencia e
-- alterar_status_ocorrencia. Depois da espera, confere novamente token, delegação e status para
-- que uma revogação ou troca de responsável concorrente não permita concluir o link antigo.
create or replace function public.concluir_tarefa(p_token text, p_comentario text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token_hash bytea;
  v_ocorrencia_id uuid;
  v_delegacao_id uuid;
begin
  if p_comentario is not null and pg_catalog.char_length(p_comentario) > 800 then
    raise exception using errcode = '22023', message = 'O comentário deve ter até 800 caracteres.';
  end if;

  -- Formato gerado por delegar_ocorrencia: 32 bytes em base64url, 43 caracteres.
  -- Respostas iguais para tokens inválidos, revogados ou já utilizados.
  if p_token is null
    or pg_catalog.char_length(p_token) <> 43
    or pg_catalog.octet_length(p_token) <> 43
    or p_token !~ '^[A-Za-z0-9_-]{43}$'
  then
    raise exception using errcode = '22023', message = 'Este link não está mais disponível.';
  end if;

  v_token_hash := extensions.digest(p_token, 'sha256');

  -- A busca inicial só encontra a ocorrência pelo hash; não filtra situação para que a decisão
  -- sobre validade seja tomada após obter o bloqueio.
  select o.id
    into v_ocorrencia_id
  from public.delegacoes d
  join public.ocorrencias o
    on o.id = d.ocorrencia_id and o.condominio_id = d.condominio_id
  where d.token_hash = v_token_hash
  for update of o;

  if not found then
    raise exception using errcode = '22023', message = 'Este link não está mais disponível.';
  end if;

  -- A trava da ocorrência serializa esta verificação com delegações novas e trocas de status.
  select d.id
    into v_delegacao_id
  from public.delegacoes d
  join public.ocorrencias o
    on o.id = d.ocorrencia_id and o.condominio_id = d.condominio_id
  where d.token_hash = v_token_hash
    and d.situacao = 'ativa'
    and o.id = v_ocorrencia_id
    and o.status = 'delegado'
  for update of d;

  if not found then
    raise exception using errcode = '22023', message = 'Este link não está mais disponível.';
  end if;

  update public.delegacoes
  set situacao = 'concluida', comentario = p_comentario, concluida_em = pg_catalog.now()
  where id = v_delegacao_id;

  update public.ocorrencias
  set status = 'concluido', concluido_em = pg_catalog.now(), updated_at = pg_catalog.now()
  where id = v_ocorrencia_id;

  -- A ação é de um visitante sem conta; autor_id fica nulo (permitido pelo modelo).
  insert into public.historico_status (ocorrencia_id, autor_id, status_anterior, status_novo)
  values (v_ocorrencia_id, null, 'delegado', 'concluido');
end;
$$;

comment on function public.concluir_tarefa(text, text) is
  'Conclui uma tarefa por token ativo, guarda comentário de até 800 caracteres e grava o histórico sem autor autenticado.';

-- Funções novas recebem EXECUTE para PUBLIC por padrão. Fechamos explicitamente o acesso e
-- liberamos somente as duas funções públicas do link para visitantes sem conta.
revoke all on function public.ver_tarefa(text) from public, anon, authenticated;
revoke all on function public.concluir_tarefa(text, text) from public, anon, authenticated;
grant execute on function public.ver_tarefa(text) to anon;
grant execute on function public.concluir_tarefa(text, text) to anon;
