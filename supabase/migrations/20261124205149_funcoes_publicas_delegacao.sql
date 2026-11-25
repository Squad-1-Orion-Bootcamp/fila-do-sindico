-- Funções públicas do link de delegação (SQUAD1-75, história SQUAD1-54).
-- O visitante recebe somente os dados necessários para executar a tarefa. O token puro não é
-- armazenado: a comparação usa o hash SHA-256 já guardado em delegacoes.

-- ---------------------------------------------------------------------------
-- 1. Consultar tarefa pelo link (o preview do WhatsApp pode chamar esta função)
-- ---------------------------------------------------------------------------
-- A US 3 pede dois avisos diferentes quando o link não vale mais. Por isso a função devolve
-- uma linha para todo token que existe, e os dados da tarefa só para o token ativo:
--   * 'ativa': condomínio, local e descrição preenchidos;
--   * 'concluida': a tarefa foi encerrada (pelo funcionário ou pelo gestor), sem dados;
--   * 'revogada': o gestor trocou o responsável ou assumiu de volta, sem dados.
-- Token inválido ou inexistente: nenhuma linha. O token tem 32 bytes aleatórios e é impossível
-- de adivinhar, então a situação só chega a quem recebeu o link. Esta função não altera dados.
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
  select
    case when t.vale then t.nome end,
    case when t.vale then t.local end,
    case when t.vale then t.descricao end,
    case
      when t.vale then 'ativa'
      when t.d_situacao = 'concluida' or t.o_status = 'concluido' then 'concluida'
      else 'revogada'
    end
  from (
    select
      c.nome, o.local, o.descricao, d.situacao as d_situacao, o.status as o_status,
      (d.situacao = 'ativa' and o.status = 'delegado') as vale
    from public.delegacoes d
    join public.ocorrencias o
      on o.id = d.ocorrencia_id and o.condominio_id = d.condominio_id
    join public.condominios c on c.id = d.condominio_id
    where p_token is not null
      and pg_catalog.char_length(p_token) = 43
      and pg_catalog.octet_length(p_token) = 43
      and p_token ~ '^[A-Za-z0-9_-]{43}$'
      and d.token_hash = extensions.digest(p_token, 'sha256')
  ) t;
$$;

comment on function public.ver_tarefa(text) is
  'Devolve a situação do link (ativa, concluida ou revogada) e, só para o link ativo, nome do condomínio, local e descrição.';

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
  v_comentario text := nullif(pg_catalog.btrim(p_comentario), '');
  v_encerrada boolean;
begin
  -- Comentário só com espaços conta como sem comentário.
  if v_comentario is not null and pg_catalog.char_length(v_comentario) > 800 then
    raise exception using errcode = '22023', message = 'O comentário deve ter até 800 caracteres.';
  end if;

  -- Formato gerado por delegar_ocorrencia: 32 bytes em base64url, 43 caracteres.
  -- Token inválido ou inexistente recebe uma mensagem genérica.
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

  -- O token existe, mas não vale mais: os mesmos dois avisos da ver_tarefa.
  if not found then
    select d.situacao = 'concluida' or o.status = 'concluido'
      into v_encerrada
    from public.delegacoes d
    join public.ocorrencias o
      on o.id = d.ocorrencia_id and o.condominio_id = d.condominio_id
    where d.token_hash = v_token_hash;

    if v_encerrada then
      raise exception using errcode = '22023', message = 'Esta tarefa já foi encerrada.';
    end if;
    raise exception using errcode = '22023', message = 'Esta tarefa não está mais atribuída a você.';
  end if;

  update public.delegacoes
  set situacao = 'concluida', comentario = v_comentario, concluida_em = pg_catalog.now()
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
-- liberamos as duas funções públicas do link para visitantes sem conta e também para quem está
-- logado: quem abre o link num navegador com sessão (por exemplo, o gestor no próprio celular)
-- chama como authenticated. O acesso vem do token, não do papel.
revoke all on function public.ver_tarefa(text) from public, anon, authenticated;
revoke all on function public.concluir_tarefa(text, text) from public, anon, authenticated;
grant execute on function public.ver_tarefa(text) to anon, authenticated;
grant execute on function public.concluir_tarefa(text, text) to anon, authenticated;
