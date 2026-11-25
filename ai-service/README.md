# ai-service

Serviço de IA da Fila do Síndico (Python + FastAPI). Hoje classifica ocorrências com regras
provisórias por palavra-chave; na Sprint 2 passa a usar um LLM com saída estruturada.

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
  - `LLM_API_KEY`: chave da Gemini, vazia por enquanto.
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
   `gravar_classificacao`, com `origem = 'regra'` enquanto o LLM não entra.

Falhas ficam no log, e a ocorrência continua em "Aguardando triagem".

## Estrutura

- `app/main.py`: rotas (`GET /health`, `POST /classificar`)
- `app/webhook.py`: `POST /webhook`, o aviso do banco
- `app/banco.py`: leitura da ocorrência e gravação da classificação pela API do Supabase
- `app/schemas.py`: contratos de entrada e saída (urgência, categoria, justificativa)
- `app/classifier.py`: lógica de classificação (provisória)
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

As regras provisórias (`app/classifier.py`) usam a mesma comparação por palavra. Decisões em
`docs/decisoes.md` (25/11/2026).
