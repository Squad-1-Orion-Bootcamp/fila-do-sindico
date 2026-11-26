# Classificar pendentes (SQUAD1-80)

Data: 25/11/2026

## Técnica

| Decisão | Motivo |
| --- | --- |
| Ao abrir o painel, o gestor chama `classificar_pendentes()`, que pede ao ai-service (`POST /classificar-pendentes`) a classificação de até 20 ocorrências sem prioridade, das mais antigas para as mais novas | Rede de segurança para o aviso do gatilho que se perde (ai-service fora do ar, reinício no meio da classificação, Vault vazio). Sem `pg_cron`, que manteria o Render sempre acordado |
| A função só chama o ai-service se existir ocorrência sem prioridade criada há mais de 2 minutos | Não acordar o Render à toa (decisão do Pedro). As mais novas ficam de fora porque o aviso do gatilho ainda pode estar a caminho (ele espera até 90 s) |
| No máximo um pedido por minuto, somando todos os gestores. A conferência de pendentes é global, não só dos condomínios de quem chama | O ai-service classifica as pendentes de todos os condomínios. Sem o limite, um gestor em loop geraria um pedido HTTP com o segredo por chamada (achado M1 do `revisor-rls`) |
| No ai-service, uma rodada por vez: se outra já está em andamento, a nova não começa | Dois gestores abrindo o painel juntos não classificam a mesma ocorrência duas vezes |
