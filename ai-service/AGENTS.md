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
- `app/schemas.py` — contratos Pydantic de entrada e saída
- `app/classifier.py` — lógica de classificação (regras provisórias na Sprint 1; LLM na Sprint 2)
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
- Chaves (`LLM_API_KEY`, `WEBHOOK_SECRET`) só em `.env`; atualize o `.env.example`.
- Type hints em tudo; formatação pelo ruff.
