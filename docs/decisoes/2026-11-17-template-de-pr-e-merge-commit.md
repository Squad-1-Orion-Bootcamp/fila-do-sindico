# Template de PR e merge commit

Data: 17/11/2026

## Técnica

| Decisão | Motivo |
| --- | --- |
| O template de PR não tem mais o item "Sei explicar todo o código desta PR"; a orientação continua no `AGENTS.md` | É uma caixa que todo mundo marca sem pensar; a garantia de verdade é a revisão humana obrigatória da PR |
| PRs entram por merge commit (merge comum), nunca squash, também na `develop`; cada commit da branch segue Conventional Commits e o título da PR vira a mensagem do merge commit | Mantém o histórico de commits e alterações; quando mais de uma pessoa colabora na mesma branch, nada do que cada uma fez é apagado |
