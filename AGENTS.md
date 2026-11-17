# Fila do Síndico — instruções para agentes de IA

Lido por Claude Code (via `CLAUDE.md`), Codex e GitHub Copilot. Cada pasta tem um `AGENTS.md`
com detalhes próprios: `web/`, `ai-service/`, `supabase/`.

## O projeto

Fila única de ocorrências, priorizada por IA, para gestores (síndicos e administradoras) com
vários condomínios. Bootcamp Orion (New Rizon), entrega final em 11/12/2026.

Fluxo principal: o gestor cria a conta e cadastra condomínios → o morador se cadastra
escolhendo o condomínio → o gestor aprova → o morador registra ocorrências → o gestor vê as
ocorrências de todos os seus condomínios numa fila só (a IA prioriza a partir da Sprint 2).

| Pasta | Stack |
| --- | --- |
| `web/` | React + TypeScript + Vite, Supabase JS. Deploy na Vercel |
| `ai-service/` | Python 3.12 + FastAPI, gerenciado com uv. Deploy em container |
| `supabase/` | Postgres, Auth, Storage e RLS, via Supabase CLI |

## Comandos

```bash
npx supabase start && npx supabase db reset   # banco local (migrações + seed)
docker compose up --build                     # web (5173) + ai-service (8000)

cd web && npm run lint && npm run build       # front
cd ai-service && uv run ruff check . && uv run ruff format --check . && uv run pytest
npx supabase migration new <nome>             # nova migração
```

Antes de dizer que terminou: rode o lint e os testes da pasta que você alterou.

## Regras que não podem ser quebradas

1. **Nunca use a `service_role` key no front.** O front usa só a `anon key`; quem protege os
   dados é o RLS.
2. **O papel do usuário fica em `profiles.role`** (`admin`, `gestor`, `morador`), gravado pelo
   banco. Nunca leia ou grave papel em `user_metadata`: o usuário consegue alterá-lo.
3. **Toda mudança no banco é uma migração nova** em `supabase/migrations/`. Nunca edite uma
   migração que já foi aplicada em outro ambiente, e nunca altere o banco só pelo painel.
4. **Toda tabela nova nasce com RLS ligado e com políticas.** Siga a skill `nova-tabela`.
5. **Escritas sensíveis passam por funções do banco**, não por `update` livre do front
   (ex.: `aprovar_vinculo`: o gestor muda só o status, nunca os dados do morador).
6. **Nenhuma chave ou senha no código.** Use `.env` / `.env.local` e atualize o `.env.example`.
7. **Não invente regra de negócio.** Se a história não diz, pergunte. Decisões tomadas ficam em
   `docs/decisoes.md` — leia antes de mudar comportamento.

## Modelo de dados (resumo)

- `profiles` (1:1 com `auth.users`): `role`, `nome`
- `condominios`: `nome`, `cnpj` único
- `vinculos`: quem acessa qual condomínio — `usuario_id`, `condominio_id`, `tipo`
  (`gestor`, `morador`, `funcionario`), `unidade`, `status` (`pendente`, `aprovado`,
  `recusado`), `aprovado_por`, `aprovado_em`
- `ocorrencias`: `condominio_id`, `registrado_por`, `local`, `descricao`, `status`, e
  `urgencia`, `categoria`, `justificativa` (preenchidas pela IA a partir da Sprint 2)

Uma conta tem um tipo só. Gestor vê os condomínios com vínculo aprovado; morador vê as
próprias ocorrências. O painel do gestor mostra todos os condomínios juntos; filtrar por um
condomínio é opcional, nunca a visão padrão.

## Convenções

- Textos da interface, mensagens de erro e comentários em **português**. Nomes de tabelas e
  colunas em português, sem acento (`ocorrencias`, `condominio_id`).
- **Gitflow**: branch base `develop`; trabalho em `feature/SQUAD1-123-descricao` (o código vem da
  issue do Linear); PR para `develop`. `main` só recebe `release/` e `hotfix/`.
- **Conventional Commits** em português: `feat: tela de cadastro do gestor`.
- Mudanças pequenas e focadas na issue. Não refatore o que não foi pedido.
- Mudou tabela, rota ou variável de ambiente? Atualize o README da pasta.

## Skills e revisores

Passo a passo para tarefas que se repetem (formato do Claude Code, mas é Markdown comum: em
outras ferramentas, peça para "seguir o arquivo"):

- `.claude/skills/nova-tabela/SKILL.md` — criar ou alterar tabela com RLS
- `.claude/skills/nova-tela/SKILL.md` — criar uma página do front

Revisões focadas:

- `.claude/agents/revisor-rls.md` — procura vazamento de dados entre usuários nas migrações
- `.claude/agents/revisor-pr.md` — confere a definição de pronto antes de abrir a PR

## Para humanos usando IA

Revise todo código gerado e só abra PR com código que você consegue explicar. Políticas de
RLS sempre passam por revisão humana e pelo teste com dois usuários, mesmo que o revisor de IA
aprove.
