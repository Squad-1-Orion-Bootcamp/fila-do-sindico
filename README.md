# Fila do Síndico

Fila única de ocorrências, priorizada por IA, para síndicos profissionais que gerenciam vários
condomínios. Projeto do Squad 1 no Orion Bootcamp (New Rizon), com entrega em 11/12/2026.

## Estrutura

| Pasta | O que é | Stack |
| --- | --- | --- |
| `web/` | Front do síndico e do morador | React + TypeScript + Vite |
| `ai-service/` | Classificação das ocorrências | Python + FastAPI |
| `supabase/` | Banco, Auth, Storage e políticas de acesso (RLS) | Postgres via Supabase CLI |
| `docs/` | Decisões do time | Markdown |

```
morador registra ocorrência (web) → Supabase grava → Database Webhook → ai-service classifica
→ grava urgência, categoria e justificativa → quadro do síndico atualiza (Realtime)
```

## Rodar com Docker (recomendado)

Só precisa de **Docker** (com Docker Compose) e **Node.js 22+** (para o CLI do Supabase).

```bash
# 1. Supabase local (o CLI sobe os containers dele)
npx supabase start          # imprime a API URL e a anon key
npx supabase db reset       # aplica as migrações e o seed

# 2. Variáveis do front
cp web/.env.example web/.env.local   # cole a API URL e a anon key do passo 1

# 3. Front + serviço de IA, com hot reload
docker compose up --build
```

- Front: http://localhost:5173
- Serviço de IA: http://localhost:8000/docs
- Studio do Supabase: http://127.0.0.1:54323

Editar arquivos na sua máquina recarrega os containers automaticamente.
Mudou `package.json` ou `pyproject.toml`? Rode `docker compose up --build` de novo.

Comandos úteis:

```bash
docker compose exec ai-service pytest          # testes do serviço de IA
docker compose exec ai-service ruff check .    # lint do serviço de IA
docker compose exec web npm run lint           # lint do front
docker compose logs -f ai-service              # logs
docker compose down                            # derruba front e IA
npx supabase stop                              # derruba o Supabase
```

**Por que o Supabase fica fora do compose?** O CLI já roda o Supabase em Docker (banco, Auth,
Storage, Studio e outros serviços) e cuida das migrações. Replicar isso no nosso compose
duplicaria a configuração sem ganho.

**Endereços entre containers:** o navegador acessa o Supabase por `127.0.0.1:54321`, mas de
dentro de um container o endereço é `host.docker.internal:54321` (o compose já define
`SUPABASE_URL` assim no ai-service). Pelo mesmo motivo, o Database Webhook do Supabase deve
chamar o serviço de IA em `http://host.docker.internal:8000`.

### Imagens de produção

```bash
docker build --target prod -t fila-web \
  --build-arg VITE_SUPABASE_URL=<url> --build-arg VITE_SUPABASE_ANON_KEY=<anon-key> web
docker build --target prod -t fila-ai-service ai-service
```

O front vira arquivos estáticos servidos por nginx; o serviço de IA roda sem reload e sem
dependências de desenvolvimento. O CI constrói as duas imagens a cada PR.

## Rodar sem Docker

Pré-requisitos: Node.js 22+, Python 3.12+ e [uv](https://docs.astral.sh/uv/). O Supabase local
continua precisando de Docker.

```bash
# 1. Supabase local (sobe Postgres, Auth, Storage e o Studio)
npx supabase start          # imprime a API URL e a anon key
npx supabase db reset       # aplica as migrações e o seed

# 2. Front
cd web
cp .env.example .env.local  # cole a API URL e a anon key do passo 1
npm install
npm run dev                 # http://localhost:5173

# 3. Serviço de IA
cd ../ai-service
uv sync
uv run uvicorn app.main:app --reload --port 8000   # http://localhost:8000/docs
```

Studio local do Supabase: http://127.0.0.1:54323

### Criar um síndico para testar

Síndicos são criados pelo time, não por tela de cadastro. Veja as instruções em
`supabase/seed.sql`.

## Banco de dados

Toda mudança no banco é uma migração versionada em `supabase/migrations/`:

```bash
npx supabase migration new nome_da_mudanca   # cria o arquivo SQL
npx supabase db reset                        # reaplica tudo do zero localmente
```

Nunca altere o banco da nuvem direto pelo painel sem criar a migração correspondente.

## Como trabalhamos

- Cada tarefa sai de uma issue do Linear (time Squad1, projeto "Projeto Fila do Síndico").
- Branch a partir da `main`: `tipo/LUCAS-123-descricao-curta` (ex.: `feat/LUCAS-12-tela-login`).
- Commits no padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/):
  `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- Toda mudança entra por Pull Request com pelo menos uma revisão. O CI precisa passar.
- Chaves e senhas ficam em `.env` / `.env.local`, nunca no repositório.

## Definição de pronto

- PR revisada por pelo menos uma pessoa e CI verde
- Critérios de aceite da história conferidos
- Funciona no ambiente compartilhado, não só na máquina de quem fez
- README ou nota curta quando muda algo que os outros usam (tabela, rota, variável de ambiente)
