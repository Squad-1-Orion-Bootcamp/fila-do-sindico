# Modelo de dados

Data: 18/11/2026

## Produto e acesso

| Decisão | Motivo |
| --- | --- |
| Na Sprint 1, o gestor cadastra o condomínio (`cadastrar_condominio`) e já começa a usar; a análise do admin (`solicitacoes_condominio`) fica para depois | Mudança de última hora para a demo da Sprint 1 |
| O pedido do morador fica em `solicitacoes_vinculo` (`pendente`, `aprovada`, `recusada`); aprovado, vira um vínculo `ativo` com vigência, e a unidade vai para `imoveis` | Segue o documento "Modelo de dados da Fila do Síndico": pedido e acesso são coisas diferentes, e o histórico fica guardado |
| Vínculo de gestor só é encerrado pelo admin; de morador ou funcionário, pelo gestor do condomínio ou pelo admin. Ninguém encerra o próprio vínculo, e o motivo é obrigatório | Decisão do time |
| A ocorrência guarda o canal em `origem`: `aplicativo` (registrada pelo morador, o padrão), `whatsapp`, `telefone`, `presencial` ou `vistoria` (registrada pelo gestor) | Toda ocorrência tem origem, e dá para comparar os canais depois (SQUAD1-30) |
| Quem relatou ao gestor (`relatado_por`) é opcional e precisa ser morador ou funcionário ativo do condomínio; quem não tem conta fica em branco | Decisão do time (SQUAD1-30) |
| Quem sai do condomínio: o ex-morador continua vendo as ocorrências que registrou pelo app (histórico); o ex-gestor perde o acesso também às que ele registrou | Decisão do time; vínculo encerrado perde o acesso aos dados do condomínio (SQUAD1-30) |
| Chat (`conversas` e `mensagens`) fica para o futuro | Fora do escopo das primeiras sprints |

## Técnica

| Decisão | Motivo |
| --- | --- |
| Tabelas, sequências e funções novas nascem sem acesso para `anon` e `authenticated`; cada migração dá os próprios `grant` | Nada fica exposto na API sem alguém liberar de propósito (apontado pelo `revisor-rls`) |
| Visitante (`anon`) lê só `id` e `nome` dos condomínios com gestor ativo; logado, cada pessoa vê só os condomínios em que tem vínculo ativo | O CNPJ e os demais dados não ficam públicos |
