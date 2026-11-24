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

Publicado no Render (plano Free): <https://fila-do-sindico.onrender.com>.

- **Imagem:** o Render constrói este `Dockerfile` a partir desta pasta (*Root Directory*
  `ai-service`) e usa o último estágio, o `prod`: sem reload, sem dependências de
  desenvolvimento e com usuário sem privilégios.
- **Health check:** `GET /health`.
- **Branch:** `develop` durante a Sprint 2. Depois da promoção `develop → stage → prod`, a
  `prod`.
- **Variáveis**, cadastradas no painel do Render, nunca no repositório:
  - `PORT=8000`: a porta do uvicorn, para o Render saber para onde mandar as requisições.
  - `WEBHOOK_SECRET`: o mesmo valor cadastrado no Vault do Supabase para o gatilho.
  - `LLM_API_KEY`: chave da Gemini, vazia por enquanto.
- **Dorme depois de 15 minutos sem uso** e leva cerca de 1 minuto para voltar. Antes de uma
  demo, abra <https://fila-do-sindico.onrender.com/health> para acordá-lo.

A configuração completa está no README da raiz, seção Deploy.

## Estrutura

- `app/main.py`: rotas (`GET /health`, `POST /classificar`)
- `app/schemas.py`: contratos de entrada e saída (urgência, categoria, justificativa)
- `app/classifier.py`: lógica de classificação (provisória)
- `app/config.py`: variáveis de ambiente
