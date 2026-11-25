# Menos conflitos na documentação (SQUAD1-87)

Data: 25/11/2026

**Proposta** (pedido do mentor, para o time aprovar ou mudar na PR).

## Contexto

Em 25/11, 8 PRs abertas tiveram conflito ao trazer a `develop` ou a PR de que dependiam
(a #45, duas vezes no mesmo dia).
Só a #27 e a #33 tiveram conflito de código (regras do `classifier.py` e testes do ai-service).
Todos os outros foram em documentação, sempre nos mesmos pontos:

- `docs/decisoes.md`: a regra era "decisão nova entra no topo", então toda PR escrevia na mesma linha;
- `supabase/AGENTS.md`: a lista de migrações era um parágrafo corrido,
  e cada migração nova mudava as últimas linhas dele;
- tabelas de funções e listas de arquivos em que todo mundo acrescentava a linha no fim;
- cadeias de PRs dependentes (#35 → #36 → #37 → #38), em que cada mudança na base exige
  trazer tudo de novo em cada PR de baixo.

## Técnica

| Decisão | Motivo |
| --- | --- |
| As decisões ficam em `docs/decisoes/`, um arquivo por decisão ou issue (`AAAA-MM-DD-squad1-XX-assunto.md`), no lugar do `docs/decisoes.md` | Duas PRs nunca editam o mesmo arquivo de decisão. É o padrão de ADR (Architecture Decision Records) |
| O `supabase/AGENTS.md` não lista mais as migrações: a lista é a pasta `supabase/migrations/`, e cada migração começa com um comentário dizendo o que faz e a issue | Toda PR com migração mexia no mesmo parágrafo. Os comentários já existiam em todas as migrações |
| Tabelas de funções e listas de arquivos ficam em ordem alfabética, e a linha nova entra no lugar dela | Cada PR acrescenta num ponto diferente, em vez de todas no fim |
| No Markdown, uma frase por linha (ou quebra em vírgula), e nunca refazer as quebras de um parágrafo que você não mudou | Mudar uma frase muda uma linha. Refazer as quebras transforma uma mudança pequena num conflito grande |
| A PR que é base de outra tem prioridade na revisão e no merge | Quanto antes a base entra, menos vezes as PRs de baixo precisam trazer a base de novo |
| PR aberta por mais de um dia traz a `develop` todo dia (`git merge origin/develop`) | Conflito pequeno e frequente é mais fácil que um grande no fim |
| Não usar `merge=union` no `.gitattributes` | Junta as duas versões sem avisar, pode duplicar ou embaralhar linhas de tabela, e o GitHub ignora isso ao dizer se a PR tem conflito |
