# Webhook do ai-service (SQUAD1-63)

Data: 24/11/2026

## Técnica

| Decisão | Motivo |
| --- | --- |
| O ai-service usa os valores de urgência do banco (`urgente`, `alta`, `normal`, `baixa`) também no `/classificar` | Contrato da SQUAD1-56; com `media`, o banco recusaria a gravação |
| O `/webhook` usa só o `id` do aviso: a descrição e o local vêm do banco, com a `service_role`, e a ocorrência já classificada é ignorada antes de chamar o classificador | Com o segredo vazado, ninguém muda a prioridade mandando outro texto; e o reenvio do gatilho não gasta a cota da Gemini (sugestões do `revisor-rls` na #24) |
| Com `WEBHOOK_SECRET` vazio no servidor, o `/webhook` recusa toda chamada (401) | Um servidor sem segredo configurado não pode aceitar qualquer chamada |
