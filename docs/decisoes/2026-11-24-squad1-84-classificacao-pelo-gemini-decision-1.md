# Classificação pelo Gemini Decision 1 (SQUAD1-84)

Data: 24/11/2026

## Produto e acesso

| Decisão | Motivo |
| --- | --- |
| Emergência com risco de vida (incêndio, fogo, pessoa presa no elevador) entra na trava e vira sempre `urgente` | Decisão do Lucas: o formulário vai avisar para ligar 193 ou 192 (card de front à parte), mas o morador pode ignorar o aviso, ou ligar e registrar também |

## Técnica

| Decisão | Motivo |
| --- | --- |
| O Gemini Decision 1 decide a urgência e a categoria; se ele der erro, demorar ou a `LLM_API_KEY` estiver vazia, as regras por palavra-chave decidem (origem `regra`). A trava vale nos dois casos (`ia+trava` ou `regra+trava`) | A ocorrência nunca fica sem prioridade, e a origem gravada mostra quantas vezes a IA respondeu (proposta da IA de 23/11) |
| Chamada ao Decision 1 com limite de cerca de 3 s e sem nova tentativa | Por padrão o SDK tenta de novo até 4 vezes, com espera de até 30 s; com o limite estourado, é melhor cair logo nas regras |
| `modelo_versao` é `gemini-decision-1` quando o Decision 1 decidiu e `regras-provisorias` quando as regras decidiram | Saber qual modelo classificou cada ocorrência |
| A confiança do Decision 1 vai só para o log; gravar no banco e sinalizar "revisar a prioridade" ficam para a Sprint 3 | Precisa de coluna nova (migração), fora do escopo da Sprint 2 |
| As urgências e as categorias, com a descrição de cada uma, ficam em `ai-service/app/contrato.py`; a lista ainda é proposta | O Pedro revisa na SQUAD1-56; no Decision 1, as descrições fazem o papel do prompt |
