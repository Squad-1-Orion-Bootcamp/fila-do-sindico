# Gestor altera a prioridade (SQUAD1-60)

Data: 24/11/2026

## Produto e acesso

| Decisão | Motivo |
| --- | --- |
| O motivo do gestor ao confirmar ou mudar a prioridade é opcional | Corrigir um falso urgente com um clique (SQUAD1-64); quando o gestor escreve, o motivo fica salvo |
| Confirmar a prioridade sugerida também conta como escolha do gestor: a IA não muda mais a urgência depois | A escolha do gestor sempre vence a IA e a trava (SQUAD1-56); a US 1 fala em "confirmar ou alterar" |
| A prioridade de uma ocorrência concluída não muda mais | Ela já saiu da fila; mudar não teria efeito |

## Técnica

| Decisão | Motivo |
| --- | --- |
| A escolha do gestor fica em `decisoes` com a ação nova `definir_prioridade`, e a IA confere essa tabela antes de mudar `urgencia_atual` | Usa a tabela de decisões que já existia, com autor, data e a sugestão da IA que foi confirmada ou corrigida, sem coluna nova em `ocorrencias` |
