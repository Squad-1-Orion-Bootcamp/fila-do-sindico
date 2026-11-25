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
morador registra ocorrência (web) → Supabase grava → gatilho (pg_net) → ai-service classifica
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
docker compose exec web npm test               # testes do front
docker compose logs -f ai-service              # logs
docker compose down                            # derruba front e IA
npx supabase stop                              # derruba o Supabase
```

**Por que o Supabase fica fora do compose?** O CLI já roda o Supabase em Docker (banco, Auth,
Storage, Studio e outros serviços) e cuida das migrações. Replicar isso no nosso compose
duplicaria a configuração sem ganho.

**Endereços entre containers:** o navegador acessa o Supabase por `127.0.0.1:54321`, mas de
dentro de um container o endereço é `host.docker.internal:54321` (o compose já define
`SUPABASE_URL` assim no ai-service). Pelo mesmo motivo, o banco chama o serviço de IA em
`http://host.docker.internal:8000`.

**Classificação automática no local.** A cada ocorrência nova, o gatilho `classificar_ocorrencia`
chama o `POST /webhook` do ai-service. O endereço e o segredo ficam no Vault do banco, nunca no
código. O `db reset` apaga o Vault, então rode isto depois de cada reset (no SQL Editor do Studio
ou com `psql`), usando o mesmo valor de `WEBHOOK_SECRET` do `ai-service/.env`:

```sql
select vault.create_secret('http://host.docker.internal:8000', 'ai_service_url');
select vault.create_secret('<o WEBHOOK_SECRET do ai-service/.env>', 'ai_webhook_secret');
```

Sem esses dois valores, a ocorrência é registrada normalmente e fica em "Aguardando triagem".
Para conferir as chamadas: `select * from net._http_response order by id desc;` (202 é sucesso,
401 é segredo diferente do `ai-service/.env`).

Para o ai-service gravar a classificação, o `ai-service/.env` também precisa da
`SUPABASE_SECRET_KEY` local (a "Secret key", `sb_secret_...`, que o `npx supabase status` mostra).

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

**Classificação na nuvem.** Em cada projeto do Supabase (stage e prod), cadastre uma vez no SQL
Editor o endereço do ai-service daquele ambiente e o segredo do webhook (o mesmo `WEBHOOK_SECRET`
configurado no ai-service publicado), com os comandos `vault.create_secret` acima. Os valores
ficam só no Vault do projeto. Fora do local, o endereço precisa ser `https://`: o segredo e a
descrição da ocorrência vão nessa chamada.

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

**Serviço de IA → Render.** Ele é um servidor de verdade, então usa a imagem de produção:

```bash
docker build --target prod -t fila-ai-service ai-service
```

Ela roda sem reload, sem dependências de desenvolvimento e com usuário sem privilégios.
O CI constrói a imagem a cada PR.

O serviço fica no Render, com um serviço para cada ambiente. No Render, cada serviço acompanha
uma branch só, então a `stage` e a `prod` são dois serviços:

| Ambiente | Branch | Endereço | Supabase |
| --- | --- | --- | --- |
| stage | `stage` | <https://fila-do-sindico-r38q.onrender.com> ([`/health`](https://fila-do-sindico-r38q.onrender.com/health)) | projeto de stage |
| prod | `prod` | <https://fila-do-sindico-31lo.onrender.com> ([`/health`](https://fila-do-sindico-31lo.onrender.com/health)) | projeto de produção (a demo) |

Na `develop` não há serviço no Render: o ai-service roda local, com o Supabase local.

- **Configuração** (feita pelo painel do Render, igual nos dois): Web Service com runtime
  Docker, plano Free, este repositório com *Root Directory* `ai-service` e health check em
  `/health`. O Render constrói o último estágio do `ai-service/Dockerfile`, que é o `prod`.
  Só muda a branch e as variáveis.
- **Por que dois:** cada serviço acompanha a mesma branch que o banco do seu ambiente, então o
  código do ai-service sempre combina com o esquema do banco. As 750 horas grátis por mês são
  do workspace inteiro, e serviço dormindo não gasta hora, então os dois cabem no plano Free.
- **Variáveis** (no painel, *Environment*), com valores próprios em cada serviço:

  | Variável | Para quê |
  | --- | --- |
  | `PORT` | `8000`, a porta em que o uvicorn escuta. Diz ao Render para onde mandar as requisições |
  | `WEBHOOK_SECRET` | Segredo compartilhado com o gatilho do Supabase: o mesmo valor fica no Vault do projeto do Supabase do mesmo ambiente. Um segredo diferente em cada ambiente. Nunca no repositório. Vazio, o `/webhook` recusa tudo |
  | `SUPABASE_URL` | URL do projeto do Supabase do mesmo ambiente (stage no serviço de stage, produção no de prod) |
  | `SUPABASE_SECRET_KEY` | Chave secreta (`sb_secret_...`) desse mesmo projeto, em *Project Settings → API Keys*: o webhook lê a ocorrência e grava a classificação com ela. Só no Render, nunca no front nem no repositório |
  | `LLM_API_KEY` | Chave da Gemini. Vazia até o serviço passar a usar o LLM |

- **No Vault de cada projeto do Supabase**, `ai_service_url` aponta para o serviço do mesmo
  ambiente (stage → endereço de stage; prod → endereço de prod).
- **Ele dorme.** No plano grátis, o serviço desliga depois de 15 minutos sem uso e leva cerca de
  1 minuto para voltar. **Antes de uma demo**, abra
  <https://fila-do-sindico-31lo.onrender.com/health> e espere a resposta. Quando ele responder,
  já está acordado.

Não há `render.yaml`: a documentação do Render não garante que um Blueprint assuma os serviços
criados pelo painel sem criar outros. Mudou algo no painel? Atualize esta seção.

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
`gestora.helena@teste.local`: ela tem 3 condomínios, ocorrências urgentes e simples, um
cadastro pendente e dois ou três funcionários em cada condomínio, para a delegação. Os
celulares dos funcionários são fictícios: abra o link do WhatsApp, mas não envie a mensagem.
Também dá para criar contas pelo próprio app: cadastro de gestor e pré-cadastro de morador.

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

| Branch | Função | Recebe PR de | Front | Serviço de IA | Banco |
| --- | --- | --- | --- | --- | --- |
| `develop` | Integração do dia a dia; **branch base** | `feature/*` e `hotfix/*` | `localhost:5173` e um preview por PR | `localhost:8000` | Supabase local de cada um |
| `stage` | Homologação e ensaio | só `develop` | a definir (domínio fixo na Vercel) | <https://fila-do-sindico-r38q.onrender.com> | Supabase de stage |
| `prod` | Produção: a demo para a banca | `stage` e `hotfix/*` | <https://fila-do-sindico.vercel.app> | <https://fila-do-sindico-31lo.onrender.com> | Supabase de produção |

Não existem `main` nem `release/`. O CI (`origem-pr`) recusa PR para a `stage` ou a `prod` vinda
de outra origem. Cada ambiente tem o próprio banco e o próprio serviço de IA: a integração do
Supabase com o GitHub aplica as migrações, e o Render publica o ai-service, quando a branch do
ambiente recebe um merge. Para testar a IA num endereço público, promova `develop → stage`.

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
