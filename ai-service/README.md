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

## Estrutura

- `app/main.py`: rotas (`GET /health`, `POST /classificar`)
- `app/schemas.py`: contratos de entrada e saída (urgência, categoria, justificativa)
- `app/classifier.py`: lógica de classificação (provisória)
- `app/trava.py`: trava de palavras de risco (força urgência `urgente`)
- `app/config.py`: variáveis de ambiente
