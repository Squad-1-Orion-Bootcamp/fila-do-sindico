# ai-service

Serviço de IA da Fila do Síndico (Python + FastAPI). Classifica cada ocorrência nova com o
Gemini Decision 1 e explica a urgência com o Gemini 2.5 Flash. As regras por palavra-chave
ficam de reserva (veja [Classificação](#classificação)).

## Rodar

```bash
cd ai-service
uv sync                         # instala as dependências
cp .env.example .env            # preencha quando houver chaves
uv run uvicorn app.main:app --reload --port 8000
```

Documentação interativa: http://localhost:8000/docs

## Testes e lint

```bash
uv run pytest
uv run ruff check . && uv run ruff format --check .
```

## Produção (Render)

Publicado no Render (plano Free), um serviço por ambiente:

- **stage** (branch `stage`): <https://fila-do-sindico-r38q.onrender.com>
- **prod** (branch `prod`, a demo): <https://fila-do-sindico-31lo.onrender.com>

Na `develop`, o serviço roda só local.

- **Imagem:** o Render constrói este `Dockerfile` a partir desta pasta (*Root Directory*
  `ai-service`) e usa o último estágio, o `prod`: sem reload, sem dependências de
  desenvolvimento e com usuário sem privilégios.
- **Health check:** `GET /health`.
- **Variáveis**, cadastradas no painel de cada serviço, nunca no repositório (valores
  diferentes em stage e prod):
  - `PORT=8000`: a porta do uvicorn, para o Render saber para onde mandar as requisições.
  - `WEBHOOK_SECRET`: o mesmo valor cadastrado no Vault do Supabase do mesmo ambiente.
  - `SUPABASE_URL` e `SUPABASE_SECRET_KEY`: o projeto do Supabase do mesmo ambiente e a chave
    secreta dele (`sb_secret_...`), para ler a ocorrência e gravar a classificação.
  - `LLM_API_KEY`: chave da API da Gemini. Vazia, só as regras classificam.
- **Dorme depois de 15 minutos sem uso** e leva cerca de 1 minuto para voltar. Antes de uma
  demo, abra <https://fila-do-sindico-31lo.onrender.com/health> para acordá-lo.

A configuração completa está no README da raiz, seção Deploy.

## Webhook

O gatilho do banco chama `POST /webhook` a cada ocorrência nova (contrato na SQUAD1-59):

1. Confere o `X-Webhook-Secret` (comparação de tempo constante). Segredo errado, ausente ou
   `WEBHOOK_SECRET` vazio no servidor: **401**.
2. Responde **202** sem corpo, na hora.
3. Em segundo plano: lê a descrição e o local **no banco** pelo `id` (o texto do corpo não é
   usado), ignora a ocorrência que já tem classificação, classifica e grava pela função
   `gravar_classificacao`, com a `origem` e o `modelo_versao` que o `classificar()` devolve.

Falhas ficam no log, e a ocorrência continua em "Aguardando triagem".

## Classificação

O `classificar()` (`app/classifier.py`) segue a proposta "System 1 + System 2" da Sprint 2:

1. **Trava de risco** (`app/trava.py`): gás, choque, fumaça e outras palavras de risco na
   descrição forçam `urgente`. O local não aciona a trava.
2. **System 1, Gemini Decision 1** (`app/decisao.py`): uma chamada à Decisions API (`v1beta`)
   com duas perguntas do tipo `choice`, urgência e categoria. As opções e as descrições de cada
   uma estão em `app/contrato.py`, e essas descrições fazem o papel do prompt. Devolve também
   a confiança (0 a 1), que por enquanto só vai para o log.
3. **Reserva, regras por palavra-chave:** se o Decision 1 der erro, demorar mais que cerca de 3 s ou
   a `LLM_API_KEY` estiver vazia (aí nem tenta chamar), as regras decidem. Elas vão até `alta`:
   quem marca `urgente` é só a trava.
4. **System 2, justificativa** (`app/justificativa.py`): o Gemini 2.5 Flash, pelo Pydantic AI,
   escreve uma frase de até 200 caracteres explicando a urgência final para o gestor. Ele não
   decide nada: recebe a urgência já escolhida. Vão para a Gemini só a descrição e o local.
   Só é chamado quando o Decision 1 respondeu: se ele falhou, a Gemini provavelmente está
   fora, e fica a frase da regra ou da trava. Resposta vazia ou longa demais: pede de novo uma
   vez. Com erro ou demora de mais de cerca de 8 s, fica o motivo padrão ("Classificada como
   Alta pela IA.").

O que vai para o banco:

| Quem decidiu | `origem` | `modelo_versao` |
| --- | --- | --- |
| Decision 1 | `ia` (`ia+trava` com a trava) | `gemini-decision-1` |
| Regras | `regra` (`regra+trava` com a trava) | `regras-provisorias` |

**Sem `LLM_API_KEY`** (no local, na CI e nos testes), o serviço funciona do mesmo jeito, só
com as regras. A chave sai do [Google AI Studio](https://aistudio.google.com) e fica só no
`.env` ou no painel do Render. Opcionais: `LLM_MODELO_DECISAO` (padrão `gemini-decision-1`),
`LLM_TIMEOUT_SEGUNDOS` (padrão `3`), `LLM_MODELO_JUSTIFICATIVA` (padrão `gemini-2.5-flash`) e
`LLM_TIMEOUT_JUSTIFICATIVA_SEGUNDOS` (padrão `8`).

Nenhum teste chama a Gemini: o `tests/conftest.py` esvazia a chave e liga
`ALLOW_MODEL_REQUESTS = False` do Pydantic AI. Os testes do Decision 1 usam um cliente dublê, e
os da justificativa usam `TestModel` e `FunctionModel`.

### Testar com a Gemini de verdade

1. Crie a chave em <https://aistudio.google.com/apikey> e ponha em `ai-service/.env`
   (`LLM_API_KEY=...`). O `.env` não vai para o Git.
2. Só a justificativa (mostra o erro, se houver):

   ```bash
   uv run python -c "from app.justificativa import justificar; print(justificar('Infiltração no teto do banheiro, pingando no quarto', 'Bloco B, 302', 'alta'))"
   ```

3. A classificação inteira: suba o serviço (`uv run uvicorn app.main:app --reload --port 8000`)
   e chame

   ```bash
   curl -s localhost:8000/classificar -H 'Content-Type: application/json' \
     -d '{"descricao": "Cheiro forte de gás no corredor", "local": "Bloco A, 3º andar"}'
   ```

   O campo `justificativa` traz a frase da Gemini. Se vier o motivo padrão, o log do uvicorn
   mostra "Justificativa falhou (...)".

## Estrutura

- `app/main.py`: rotas (`GET /health`, `POST /classificar`)
- `app/webhook.py`: `POST /webhook`, o aviso do banco
- `app/banco.py`: leitura da ocorrência e gravação da classificação pela API do Supabase
- `app/contrato.py`: urgências e categorias, com a descrição de cada uma (fonte única)
- `app/schemas.py`: contratos de entrada e saída (urgência, categoria, justificativa, origem)
- `app/classifier.py`: orquestração da classificação e as regras de reserva
- `app/decisao.py`: System 1, a chamada ao Gemini Decision 1
- `app/justificativa.py`: System 2, a frase da justificativa (Pydantic AI + Gemini 2.5 Flash)
- `app/trava.py`: trava de palavras de risco (força urgência `urgente`)
- `app/config.py`: variáveis de ambiente

## Trava de palavras de risco

Antes de qualquer classificação, `app/trava.py` procura na **descrição** (nunca no local)
termos de risco. Se achar, a urgência vira `urgente`, a categoria continua a da classificação e
a justificativa cita o termo ("Trava de risco: a descrição menciona 'gás'.").

- Termos: gás (e "gases"), choque, elétrica, fumaça, vazamento grave, rachadura, fogo e incêndio.
- Pessoa presa no elevador: "preso", "presa", "presos" ou "presas" **e** "elevador" na mesma
  descrição, em qualquer ordem.
- Sem diferenciar maiúsculas e acentos, com plural ("rachaduras", "choques") e só palavra
  inteira ("gasto", "vagas" e "desgaste" não disparam).
- Exceções (`EXCECOES`): expressões em que a palavra tem outro sentido, como "fumaça de cigarro" e "choque de realidade", não disparam.
  Um risco real na mesma frase continua disparando, e o Decision 1 lê o texto original e pode marcar `urgente`.
- Equipamentos de incêndio (extintor de incêndio, porta corta-fogo e escada de incêndio) também são exceções: a IA decide, e o mínimo é `alta`.
  O mínimo é um piso no código, depois do Decision 1 (normal ou baixa sobe para alta), e não uma frase no prompt.

As regras provisórias (`app/classifier.py`) usam a mesma comparação por palavra e as mesmas exceções.
Equipamento de incêndio nas regras dá `seguranca` / `alta`.
Decisões em `docs/decisoes/2026-11-25-squad1-58-trava-de-palavras-de-risco.md` e `docs/decisoes/2026-11-26-squad1-88-excecoes-da-trava.md`.
