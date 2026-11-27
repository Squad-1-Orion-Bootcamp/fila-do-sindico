-- Leitura da service_role nas tabelas que o ai-service consulta pela API REST (SQUAD1-94).
-- O ai-service usa a chave secreta (papel service_role) para listar as pendentes e ler a
-- ocorrência com as classificações dela (app/banco.py). Projetos novos do Supabase não dão mais
-- SELECT à service_role nas tabelas do public por padrão: no projeto de stage ela tinha só
-- TRUNCATE, REFERENCES e TRIGGER, e o ai-service recebia 403. O grant fica explícito para valer
-- em qualquer projeto. Só leitura: a gravação passa pela gravar_classificacao, que é security
-- definer e tem grant próprio. Idempotente: onde o grant já existe, não muda nada.

grant select on public.ocorrencias to service_role;
grant select on public.classificacoes_ia to service_role;
