# PRs dependentes

Data: 18/11/2026

## Técnica

| Decisão | Motivo |
| --- | --- |
| PR que depende de outra ainda aberta aponta para a `develop` (a branch traz a outra por `git merge`), como rascunho e com "Depende da #NN"; nunca para a branch da outra PR | A #6 apontava para a branch da #2; a #2 entrou antes, a #6 foi mergeada nessa branch e o código não chegou à `develop` (foi preciso abrir a #11). Orientação do mentor |
| Quem aprova a PR faz o merge, seguindo a ordem das dependências | A pessoa que revisou sabe se a PR está pronta e em que ordem as PRs devem entrar |
