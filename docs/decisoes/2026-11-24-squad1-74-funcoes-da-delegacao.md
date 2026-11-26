# Funções da delegação (SQUAD1-74)

Data: 24/11/2026

## Produto e acesso

| Decisão | Motivo |
| --- | --- |
| Ocorrência concluída não pode ser delegada | A reabertura de ocorrências concluídas está fora da US 3 |
| Trocar o responsável é delegar de novo: o link anterior é revogado, e o status continua `delegado` (sem nova linha no histórico) | Decisão da US 3 (SQUAD1-74); o status não mudou, só quem cuida |

## Técnica

| Decisão | Motivo |
| --- | --- |
| O token do link tem 32 bytes aleatórios em base64url (43 caracteres) | Impossível de adivinhar e curto o bastante para a mensagem do WhatsApp |
| A `alterar_status_ocorrencia` ganhou uma nova versão que revoga a delegação ativa | Decisão do Lucas: qualquer troca de status pelo gestor revoga o link (SQUAD1-72) |
