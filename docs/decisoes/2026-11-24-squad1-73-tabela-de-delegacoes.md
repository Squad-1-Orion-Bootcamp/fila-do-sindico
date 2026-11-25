# Tabela de delegações (SQUAD1-73)

Data: 24/11/2026

## Técnica

| Decisão | Motivo |
| --- | --- |
| O banco guarda só o hash (SHA-256) do token do link; a função de delegar devolve o token uma vez, para montar o link do WhatsApp. Para mandar de novo, o gestor delega de novo | Se a tabela vazar, nenhum link funciona. O front só precisa do token na hora de delegar (SQUAD1-76) |
| `delegacoes` tem `condominio_id` e chave composta com `ocorrencias` e com `funcionarios` | O banco garante que o funcionário é do mesmo condomínio da ocorrência, além da conferência na função (SQUAD1-74) |
| O comentário do funcionário tem até 800 caracteres e só existe na delegação concluída | Mesmo limite da descrição da ocorrência |
