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

## Deploy

**Demo:** <https://fila-do-sindico.vercel.app> (publica a `develop`; banco no Supabase na nuvem).

**Banco → Supabase na nuvem.** A integração do Supabase com o GitHub aplica as migrações
sozinha a cada merge na `develop` (o check "Supabase Preview" mostra o resultado). Não rode
`supabase db push` à mão: aplicaria a mesma migração duas vezes. Para conferir, veja
*Database → Migrations* no painel.

O seed **não** vai pela integração. Para aplicar no banco da nuvem (uma vez só, num banco sem
os dados do seed):

```bash
npx supabase login
npx supabase link --project-ref <ref-do-projeto>   # pede a senha do banco
npx supabase db push --linked --include-seed
```

Logo depois, troque a senha do `admin@teste.local` no SQL Editor do painel. Ele é admin da
plataforma e a senha do seed é pública:

```sql
update auth.users
set encrypted_password = extensions.crypt('<senha-nova>', extensions.gen_salt('bf'))
where email = 'admin@teste.local';
```

No painel (*Authentication*), a confirmação de e-mail fica desligada e *URL Configuration*
aponta *Site URL* e *Redirect URLs* para o endereço da Vercel.

**Front → Vercel.** O front é estático (o build gera HTML, JS e CSS), então não precisa de
container em produção. Na Vercel:

1. *Add New → Project* e importe este repositório.
2. Em *Root Directory*, escolha `web` (a Vercel detecta o Vite sozinha).
3. Em *Environment Variables*, cadastre `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` do
   projeto do Supabase na nuvem (*Project Settings → API*: a chave anon ou publishable, nunca
   a service_role).
4. Em *Settings → Git → Production Branch*, use `develop`.

O `web/vercel.json` faz rotas como `/quadro` funcionarem ao abrir direto no navegador.
Cada PR ganha um link de preview automático.

**Serviço de IA → container.** Ele é um servidor de verdade, então usa a imagem de produção:

```bash
docker build --target prod -t fila-ai-service ai-service
```

Ela roda sem reload, sem dependências de desenvolvimento e com usuário sem privilégios.
O CI constrói a imagem a cada PR.

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

### Usuários para testar

O `supabase/seed.sql` cria gestores, condomínios, moradores e ocorrências de teste, todos com a
senha `senha123`. A lista de contas está no topo do arquivo. Para a demo, entre como
`gestora.helena@teste.local`: ela tem 3 condomínios, ocorrências urgentes e simples e um
cadastro pendente em cada condomínio. Também dá para criar contas pelo próprio app: cadastro
de gestor e pré-cadastro de morador.

## Banco de dados

Toda mudança no banco é uma migração versionada em `supabase/migrations/`:

```bash
npx supabase migration new nome_da_mudanca   # cria o arquivo SQL
npx supabase db reset                        # reaplica tudo do zero localmente
```

Nunca altere o banco da nuvem direto pelo painel sem criar a migração correspondente.

## Como trabalhamos

- Cada tarefa sai de uma issue do Linear (time Squad1, projeto "Projeto Fila do Síndico").
- Commits no padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/):
  `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- Toda mudança entra por Pull Request com pelo menos uma revisão. O CI precisa passar.
- Chaves e senhas ficam em `.env` / `.env.local`, nunca no repositório.

### Branches e ambientes

| Branch | Função | Recebe PR de | Front | Banco |
| --- | --- | --- | --- | --- |
| `develop` | Integração do dia a dia; **branch base** | `feature/*` e `hotfix/*` | `localhost:5173` e um preview por PR | Supabase local de cada um |
| `stage` | Homologação e ensaio | só `develop` | a definir (domínio fixo na Vercel) | Supabase de stage (a definir) |
| `prod` | Produção: a demo para a banca | `stage` e `hotfix/*` | <https://fila-do-sindico.vercel.app> | Supabase de produção |

Não existem `main` nem `release/`. O CI (`origem-pr`) recusa PR para a `stage` ou a `prod` vinda
de outra origem. Cada ambiente tem o próprio banco, e a integração do Supabase com o GitHub
aplica as migrações quando a branch do ambiente recebe um merge.

Dia a dia:

```bash
git switch develop && git pull
git switch -c feature/squad1-12-tela-login
# ...commits...
git push -u origin feature/squad1-12-tela-login   # abra a PR para develop
```

Fim de sprint (promoção):

1. PR `develop → stage`. Depois do merge, o time testa no endereço da `stage`.
2. Tudo certo? PR `stage → prod`. Depois do merge, crie a tag (`v0.1.0` na Sprint 1, `v0.2.0` na
   Sprint 2...): `git switch prod && git pull && git tag v0.1.0 && git push origin v0.1.0`.

Correção urgente na demo (hotfix): a branch `hotfix/squad1-123-descricao` sai da `prod`, entra
por PR na `prod` e, logo depois, a mesma branch entra por PR na `develop`. A `stage` recebe a
correção na próxima promoção.

O código da issue (`squad1-12`) no nome da branch faz o Linear ligar a PR à issue
automaticamente. Use o atalho **"Copy git branch name"** da issue no Linear
(`Ctrl/Cmd + Shift + .`): ele já gera `feature/squad1-12-titulo-da-issue`. Para `hotfix/`, troque
o começo à mão.

### Pull Requests

- **Título** no padrão Conventional Commits, terminando com a issue:
  `feat: cadastro do gestor (SQUAD1-12)`. O CI confere. As promoções (`develop → stage` e
  `stage → prod`) dispensam a issue, ex.: `chore: entrega da Sprint 1 (v0.1.0)`.
- **Uma issue por PR**, de preferência com menos de 400 linhas alteradas.
- Ainda não está pronta? Abra como **rascunho (draft)**.
- **PR que depende de outra ainda aberta:** a PR aponta sempre para a `develop`, nunca para a
  branch da outra PR. Veja [PR que depende de outra](#pr-que-depende-de-outra).
- Preencha o template; em mudança de tela, inclua **prints**.
- Rode o **`revisor-pr`** antes de pedir revisão (e o **`revisor-rls`** se mexeu no banco).
- **Revisão no mesmo dia** ou até a manhã seguinte.
- **Merge:** sempre por **merge commit** (merge comum), nunca squash, inclusive nas promoções
  (com squash, as branches divergem e cada promoção dá conflito). Os commits da branch entram
  como estão, então cada um segue Conventional Commits; o título da PR vira a mensagem do merge
  commit. **Quem aprova a PR faz o merge**, com o CI verde e seguindo a ordem das dependências
  (a PR de que outra depende entra primeiro). A branch de feature ou hotfix é apagada depois do
  merge; `develop`, `stage` e `prod` nunca.

#### PR que depende de outra

Quando a sua issue precisa do código de uma PR que ainda está em revisão (a #YY):

```bash
git switch develop && git pull
git switch -c feature/squad1-12-descricao
git merge origin/feature/squad1-yy-descricao   # traz o código da PR em revisão
```

1. Abra a PR **para a `develop`**, como **rascunho**, com "Depende da #YY" no topo da descrição.
   Nunca aponte a PR para a branch da outra: se a outra entrar antes, a sua é mergeada numa
   branch que já entrou e o código não chega à `develop`.
2. Até a #YY entrar, o diff mostra também os commits dela. Depois do merge dela, eles somem
   sozinhos (não precisa de rebase).
3. Se a #YY mudar durante a revisão, traga de novo: `git merge origin/feature/squad1-yy-descricao`.
4. Quando a #YY entrar, traga a `develop` (`git merge origin/develop`), resolva os conflitos e
   tire a PR do rascunho.

## Definição de pronto

- PR revisada por pelo menos uma pessoa e CI verde
- Critérios de aceite da história conferidos
- Funciona no ambiente compartilhado, não só na máquina de quem fez
- README ou nota curta quando muda algo que os outros usam (tabela, rota, variável de ambiente)
