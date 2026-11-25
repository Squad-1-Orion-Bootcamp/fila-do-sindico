# ai-service/ — serviço de IA (Python + FastAPI)

Siga também o `AGENTS.md` da raiz.

## Comandos

```bash
uv sync
uv run uvicorn app.main:app --reload --port 8000   # docs em http://localhost:8000/docs
uv run pytest
uv run ruff check . && uv run ruff format .
uv add <pacote>          # nunca pip install
```

## Estrutura

- `app/main.py` — rotas (`GET /health`, `POST /classificar`)
- `app/webhook.py` — `POST /webhook`: aviso do gatilho do banco (segredo, 202, classificação em
  segundo plano)
- `app/banco.py` — API REST do Supabase com a chave secreta (ler a ocorrência, chamar
  `gravar_classificacao`)
- `app/schemas.py` — contratos Pydantic de entrada e saída
- `app/contrato.py` — urgências e categorias com as descrições (fonte única do contrato)
- `app/classifier.py` — orquestração: trava → Decision 1 → regras de reserva → justificativa
- `app/decisao.py` — System 1: Gemini Decision 1 (Decisions API, `v1beta`)
- `app/justificativa.py` — System 2: frase da justificativa (Pydantic AI + Gemini 2.5 Flash)
- `app/trava.py` — trava de palavras de risco
- `app/config.py` — variáveis de ambiente via `pydantic-settings`
- `tests/` — pytest com `TestClient`

## Padrões

- O contrato de saída (`urgencia`, `categoria`, `justificativa`) é usado pelo banco e pelo
  front. Mudar um campo exige combinar com o time e atualizar a migração e o front juntos.
- A `justificativa` é para o gestor ler: uma frase clara, em português.
- Chamadas ao LLM usam saída estruturada validada pelo schema Pydantic. Nunca faça parse de
  texto livre.
- Toda rota nova tem teste. Mudou o prompt? Rode a avaliação com o conjunto de exemplos antes
  de abrir a PR (a partir da Sprint 2).
- Chaves (`LLM_API_KEY`, `WEBHOOK_SECRET`, `SUPABASE_SECRET_KEY`) só em `.env`; atualize o
  `.env.example`. A chave secreta do Supabase (papel `service_role`) existe só aqui no servidor,
  nunca no front. A chave nova (`sb_secret_...`) vai só no cabeçalho `apikey`.
- Urgência só com os valores do banco: `urgente`, `alta`, `normal`, `baixa` (SQUAD1-56).
- Type hints em tudo; formatação pelo ruff.
