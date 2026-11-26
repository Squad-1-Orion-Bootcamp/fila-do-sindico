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

- `squad03` (5): as frases da comparação com a Squad 03, com o rótulo certo.
- `armadilha` (11): palavra de risco em outro sentido (conta de gás, bicicleta elétrica, extintor de incêndio, porta corta-fogo), risco real sem a palavra que a trava procura (gente presa no elevador sem dizer "preso", "botijão", faísca, criança na janela) e duas frases com as duas coisas juntas (fumaça do churrasco e cheiro de gás; fogos de artifício e fogo na lixeira).
  A `c42` ("estou presa no elevador") confere que a trava do elevador funciona.
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
| urgencia | urgente 16 | alta 12 | normal 12 | baixa 10 |
| categoria | seguranca 11 | hidraulica 7 | convivencia 7 | elevador 6 | estrutura 6 | eletrica 6 | limpeza 4 | outros 3 |
| tipo | comum 29 | armadilha 11 | squad03 5 | injecao 3 | local 2 |
| palavra_de_risco | False 44 | True 6 |
```

Dos 16 urgentes, 10 não têm palavra de risco: `c02`, `c10`, `c11`, `c12`, `c13`, `c22`, `c23`, `c24`, `c25` e `c26`.

## Casos de fronteira (para a revisão da Júlia)

Quando dois rótulos são defensáveis, o caso fica com um deles e o `motivo` começa com "Fronteira".

- `c03` "rachadura enorme na viga da garagem": urgente × alta (não se sabe se a rachadura é nova ou está crescendo).
- `c08` extintor de incêndio vencido: normal × alta.
- `c09` porta corta-fogo emperrada: alta × normal, e seguranca × estrutura.
- `c22` cano estourado com água chegando no quadro de energia: hidraulica × eletrica.
- `c25` morador desacordado na academia: seguranca × outros (não há categoria de emergência de saúde).
- `c35` lixo acumulado com ratos: alta × normal.
- `c38` interfone que não toca: outros × eletrica.
- `c41` elevador com barulho estranho: normal × alta.

## Próximo passo (parte 2)

Um script que roda a trava, as regras e o Decision 1 contra o gabarito e mede:

- urgentes detectados (recall de `urgente`): dos 16 urgentes, quantos cada camada marcou;
- urgentes sem palavra de risco: dos 10, quantos o Decision 1 marcou;
- falsos urgentes da trava: casos que não são urgentes e que a trava marcou;
- acerto de urgência;
- acerto de categoria.
