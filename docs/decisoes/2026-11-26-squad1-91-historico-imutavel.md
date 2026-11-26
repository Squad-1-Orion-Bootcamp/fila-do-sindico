# Histórico imutável (SQUAD1-91)

Data: 26/11/2026

Decisão técnica do time, sem decisão de produto.

## Técnica

| Decisão | Motivo |
| --- | --- |
| `decisoes`, `historico_status` e `classificacoes_ia` são só de inserção, garantido por gatilho (`private.recusar_alteracao_do_historico`), inclusive contra a chave secreta e o `postgres`. UPDATE, DELETE e TRUNCATE dão erro `42501` | O registro de quem decidiu o quê não pode mudar depois de gravado. O RLS só segura o front, e o ai-service guarda a chave secreta fora do banco: se ela vazar, o histórico continua protegido |
| Antes do gatilho, foi conferido que nenhuma função, nem o front, nem o ai-service faz UPDATE ou DELETE nessas tabelas, e que nenhuma chave estrangeira com `on delete cascade` aponta para elas | O gatilho não quebra nenhum fluxo que já existe |
| Os gatilhos são `enable always` | Disparam também com `session_replication_role = replica`, que o `postgres` poderia ligar para pular gatilhos comuns |
| Uma migração que precise mesmo corrigir dados nelas desativa o gatilho só dentro dela (`alter table ... disable trigger ...` e depois `enable`) e explica o motivo | A correção fica registrada no histórico do Git, com o motivo |

## Consequência conhecida

Um pedido de exclusão de dados pela LGPD que envolva esse histórico vai exigir uma migração específica, que libere só aquele caso.

Duas coisas deixam de funcionar nessas tabelas, e quem precisar delas terá de mudar o desenho:

- atualizar uma linha depois de gravada (ex.: `classificacoes_ia.status_processamento` de `pendente` para `sucesso`): o fluxo tem de inserir uma linha nova;
- `on delete cascade` ou `on delete set null` numa chave estrangeira delas, porque viram DELETE ou UPDATE.
