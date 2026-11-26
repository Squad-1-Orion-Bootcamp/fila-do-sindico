# Quadro em colunas (SQUAD1-61)

Data: 24/11/2026

## Produto e acesso

| Decisão | Motivo |
| --- | --- |
| No painel do gestor, colunas e seletor de status usam os nomes da US 1: Novo, Em andamento, Delegado e Concluído. A página do morador continua com Pendente, Em análise e Resolvido (SQUAD1-5) | Decisão da Riane: os nomes da issue e do protótipo, iguais na coluna e no card |
| Em Novo, Em andamento e Delegado, primeiro a urgência (urgente, alta, normal, baixa), depois a mais antiga. A ocorrência que a IA ainda não classificou vem depois das classificadas | A issue pede "os mais urgentes e mais antigos primeiro"; sem classificação, ainda não se sabe a urgência |
| Em Concluído, as concluídas mais recentemente primeiro, pela data da conclusão (`concluido_em`), e não pela de registro. `listar_ocorrencias_gestor` passa a devolver essa data | Decisão da Riane: depois de concluída, a urgência não decide mais nada; o gestor abre a coluna para ver o que acabou de ser feito, e a coluna só cresce. Segue o protótipo |
| No celular, uma coluna por vez, escolhida em abas com a contagem; no tablet, duas colunas; no computador, quatro | Segue o `DESIGN.md` ("uma coluna por vez, com abas de contagem") |
