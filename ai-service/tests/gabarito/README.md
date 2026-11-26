# Gabarito da classificação (SQUAD1-66)

Relatos de ocorrência com a resposta certa de cada um, do ponto de vista de um síndico.
Serve para medir quanto a trava, as regras de reserva e o Decision 1 acertam (os números do pitch).

## Critério: rótulo pelo síndico, não pelo sistema

Cada caso tem a urgência e a categoria de que o síndico precisa, nunca o que o sistema faz hoje.
Se a trava ou as regras erram um caso, o gabarito mostra o certo, e é assim que o erro aparece na avaliação.

Os rótulos usam exatamente os valores e as descrições de `app/contrato.py` (`URGENCIAS` e `CATEGORIAS`).

## O campo `palavra_de_risco`

`palavra_de_risco` é `true` quando a descrição tem um termo de `PALAVRAS_DE_RISCO` (`app/trava.py`), ou "preso" + "elevador", usado no sentido de risco.
É `false` quando não tem nenhum desses termos, ou quando o termo aparece em outro sentido ("fumaça de cigarro", "choque de realidade", "extintor de incêndio").
Ele não diz qual é a urgência certa: diz só se existe a palavra que a trava procura, usada como risco.

Com ele, a avaliação separa dois tipos de urgente:

- **Urgentes com palavra de risco:** a trava deveria pegar.
- **Urgentes sem palavra de risco:** só a IA consegue pegar (ex.: "o elevador parou com minha mãe dentro", "cheiro forte de botijão").
  A métrica "urgentes sem palavra de risco" mostra quantos desses o Decision 1 marca como `urgente`, que é o ganho da IA sobre a trava.

E os casos com o termo em outro sentido (`palavra_de_risco` = `false`, mas a trava dispara) medem os falsos urgentes da trava.

## De onde vieram os casos

Os casos são um rascunho gerado com IA e revisado pelo time, caso a caso.
Os números são absolutos porque a amostra é pequena.

- `squad03` (5): as frases da comparação com a Squad 03, com o rótulo certo.
- `armadilha` (15): palavra de risco em outro sentido (conta de gás, bicicleta elétrica, extintor de incêndio, porta corta-fogo), risco real sem a palavra que a trava procura (gente presa no elevador sem dizer "preso", "botijão", faísca, criança na janela) e duas frases com as duas coisas juntas (fumaça do churrasco e cheiro de gás; fogos de artifício e fogo na lixeira).
  A `c42` ("estou presa no elevador") confere que a trava do elevador funciona.
  Equipamentos de incêndio (`c08`, `c09`, `c51`–`c54`) aparecem nas duas versões, sem e com risco real, pela decisão da Júlia de 26/11: sem risco, a IA decide e o mínimo é `alta`; com fumaça, fogo ou gás na frase, é `urgente`.
- `injecao` (3): texto que tenta mandar na IA ("ignore as instruções", "SISTEMA:", "responda só a palavra urgente").
  O rótulo segue o problema real, não o pedido.
- `local` (2): o local tem palavra de risco e a descrição não ("Sala elétrica", "Abrigo de gás").
  O rótulo segue a descrição.
- `comum` (29): problemas típicos de condomínio, de "vazamento" sozinho até um parágrafo, com gíria, sem acento, caixa alta e emoji.

Nenhum caso tem dado pessoal real.

## Formato

`casos.json` é uma lista de objetos com `id`, `descricao`, `local` (texto ou `null`), `urgencia`, `categoria`, `palavra_de_risco`, `tipo` e `motivo` (uma frase com o porquê do rótulo).

## Distribuição

Gerada a partir do JSON:

```bash
python -c "import json,collections as C;cs=json.load(open('ai-service/tests/gabarito/casos.json'));[print(f'| {k} | '+' | '.join(f'{v} {n}' for v,n in C.Counter(c[k] for c in cs).most_common())+' |') for k in ('urgencia','categoria','tipo','palavra_de_risco')]"
```

```text
| urgencia | urgente 19 | alta 14 | normal 11 | baixa 10 |
| categoria | seguranca 15 | hidraulica 7 | convivencia 7 | elevador 6 | estrutura 6 | eletrica 6 | limpeza 4 | outros 3 |
| tipo | comum 29 | armadilha 15 | squad03 5 | injecao 3 | local 2 |
| palavra_de_risco | False 45 | True 9 |
```

Dos 19 urgentes, 10 não têm palavra de risco: `c02`, `c10`, `c11`, `c12`, `c13`, `c22`, `c23`, `c24`, `c25` e `c26`.

## Casos de fronteira (para a revisão da Júlia)

Quando dois rótulos são defensáveis, o caso fica com um deles e o `motivo` começa com "Fronteira".

- `c03` "rachadura enorme na viga da garagem": urgente × alta (não se sabe se a rachadura é nova ou está crescendo).
- `c09` porta corta-fogo emperrada: seguranca × estrutura (a urgência `alta` foi decidida pela Júlia em 26/11).
- `c22` cano estourado com água chegando no quadro de energia: hidraulica × eletrica.
- `c25` morador desacordado na academia: seguranca × outros (não há categoria de emergência de saúde).
- `c35` lixo acumulado com ratos: alta × normal.
- `c38` interfone que não toca: outros × eletrica.
- `c41` elevador com barulho estranho: normal × alta.

## Como rodar a avaliação

```bash
cd ai-service
uv run python -m scripts.avaliar_gabarito --sistema regras --rotulo develop
uv run python -m scripts.avaliar_gabarito --sistema ia --rotulo develop
```

- `--sistema regras`, **só regras (IA fora do ar)**: trava + regras de reserva, como o `classificar()` faz quando a IA está fora.
  Não usa a rede.
- `--sistema ia`, **sistema completo (IA + trava)**: o `classificar()` de verdade, com o Decision 1 e a trava (e o piso de equipamento de incêndio, quando a branch tem a SQUAD1-88).
  Precisa de `LLM_API_KEY` no `ai-service/.env`, e cada rodada gasta a cota compartilhada: uma chamada por caso.
  A justificativa (System 2) não é avaliada e não é chamada.
  Há uma pausa de 2 s entre os casos.
- `--rotulo`: o nome da rodada (ex.: `develop`, `com-88`).
- `--casos c34,c41`: roda só esses casos e não grava o resultado (para conferir se um caso oscila entre rodadas).

O resumo sai em Markdown no terminal.
O detalhe, com o commit avaliado e a previsão de cada caso, vai para `resultados/AAAA-MM-DD-<sistema>-<rotulo>.json`.
O cálculo das métricas fica em `scripts/metricas.py`, testado em `tests/test_metricas_gabarito.py` com previsões de mentira; o `pytest` nunca chama a API.

No sistema completo, um caso em que o Decision 1 deu erro ou demorou cai nas regras (`origem` sem "ia").
Esses casos saem das métricas e aparecem separados no resumo, para o número da IA não se misturar com o das regras.

## O que cada métrica mede

- **a) Urgentes detectados:** dos casos urgentes, quantos o sistema marcou como `urgente` (recall de urgente).
  É a métrica mais importante: urgente perdido é risco para alguém.
- **b) Urgentes sem palavra de risco detectados:** o mesmo, só nos urgentes com `palavra_de_risco` = `false`.
  A trava não pega esses; é o que só a IA consegue pegar.
- **c) Falsos urgentes:** casos marcados `urgente` cujo rótulo é outro, com os ids.
  Cada um empurra para o topo da fila algo que podia esperar.
- **d) Acerto de urgência:** casos com a urgência certa, com a matriz de confusão (linha: esperado; coluna: previsto).
- **e) Acerto de categoria:** casos com a categoria certa.
- **f) Injeção:** casos do tipo `injecao` com urgência e categoria certas.
- **g) Equipamento de incêndio:** extintor, porta corta-fogo e escada de incêndio, caso a caso (`alta` sem risco real, `urgente` com risco).
- **h) Erros:** id, descrição, esperado, previsto, origem e se o caso é de fronteira.
  Erro em caso de fronteira pesa menos, porque dois rótulos são defensáveis.

**A amostra é pequena** (dezenas de casos), por isso os números são absolutos ("x de y"), com a porcentagem só entre parênteses.
Um caso a mais ou a menos muda a porcentagem em alguns pontos.
O Decision 1 também pode variar entre uma rodada e outra nos casos de confiança baixa.
