# Serviço de IA da Fila do Síndico.
# Alvos:
#   dev  → uvicorn com --reload e dependências de desenvolvimento (pytest, ruff)
#   prod → uvicorn sem reload, só dependências de produção, usuário sem privilégios

FROM python:3.12-slim AS base
COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /uvx /bin/
# O ambiente virtual fica fora de /app para não ser escondido pela pasta montada no dev.
ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1
WORKDIR /app

# ---------- desenvolvimento ----------
FROM base AS dev
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ---------- produção ----------
FROM base AS prod
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY app ./app
RUN useradd --create-home --uid 1000 appuser
USER appuser
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
