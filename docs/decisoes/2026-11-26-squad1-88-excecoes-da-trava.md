# Exceções da trava para expressões com outro sentido (SQUAD1-88)

Data: 26/11/2026

Decidido pela Júlia (product builder) em 26/11/2026.
Complementa a [trava de palavras de risco](2026-11-25-squad1-58-trava-de-palavras-de-risco.md), sem substituí-la.

## Produto e acesso

| Decisão | Motivo |
| --- | --- |
| Não disparam a trava: fumaça de cigarro, fumaça de churrasco (ou da churrasqueira), choque de realidade, fogos de artifício, conta de gás, leitura do gás e bicicleta elétrica. Vale com ou sem acento, no plural e com "de", "do" ou "da" | A palavra de risco aparece em outro sentido |
| Equipamentos de incêndio (extintor de incêndio, porta corta-fogo e escada de incêndio) também não disparam a trava: a IA decide | A trava é para risco imediato. Extintor vencido ou porta corta-fogo travada são problemas sérios, mas não de agir em minutos; forçar urgente traria de volta o falso urgente na fila |
| Problema em equipamento de incêndio é no mínimo `alta` | Para não cair para `normal`. Vale para o Decision 1 e para as regras de reserva |
| A exceção só tira a obrigação de `urgente`: o Decision 1 continua lendo o texto original e pode marcar `urgente` | Uma fumaça de cigarro pode ser urgente pelo contexto (ex.: morador passando mal), e quem avalia o contexto é a IA |
| Um risco real na mesma frase continua disparando ("fumaça de cigarro e cheiro de gás" é urgente; "extintor vencido e fumaça saindo do quadro" também) | A exceção vale só para a expressão, não para a frase inteira |

## Técnica

| Decisão | Motivo |
| --- | --- |
| Uma função única, `remover_excecoes` em `app/trava.py`, usada pela trava e pelas regras de reserva | Com a IA fora do ar, as regras não podem classificar "fumaça de cigarro" como segurança |
| O "no mínimo alta" é aplicado como piso no código, no `classificar()`, depois do Decision 1 e antes da trava: com equipamento de incêndio na descrição, `normal` ou `baixa` sobe para `alta`. A origem não muda | Primeiro foi uma frase no prompt (a descrição de `alta` em `app/contrato.py`), mas na avaliação da SQUAD1-66 ela mudou dois casos que não são de incêndio, de forma determinística: c34 (portão aberto, `alta` → `urgente`) e c41 (barulho no elevador, `normal` → `alta`) |
| Nas regras de reserva, equipamento de incêndio dá `seguranca` / `alta` antes de as exceções saírem do texto | Sem isso, com a IA fora do ar, "extintor de incêndio vencido" cairia para `normal` / `outros` |
| Cada expressão é trocada por um espaço, não por vazio | Não junta as palavras vizinhas |
| Hífen vale como espaço | "porta corta-fogo" casa com ou sem hífen |
