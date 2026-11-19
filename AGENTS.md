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
   (ex.: `aprovar_solicitacao_vinculo`: o gestor aprova ou recusa, nunca muda os dados do
   morador).
6. **Nenhuma chave ou senha no código.** Use `.env` / `.env.local` e atualize o `.env.example`.
7. **Não invente regra de negócio.** Se a história não diz, pergunte. Decisões tomadas ficam em
   `docs/decisoes.md` — leia antes de mudar comportamento.

## Modelo de dados (resumo)

Detalhes, regras de acesso e funções em `supabase/AGENTS.md`.

- `profiles` (1:1 com `auth.users`): `role`, `nome`
- `administradores_plataforma`: contas de admin (o banco grava `role = 'admin'`)
- `condominios`: `nome`, `cnpj` único; `imoveis`: `bloco` e `unidade` de cada condomínio
- `solicitacoes_vinculo`: pré-cadastro do morador — `status` (`pendente`, `aprovada`,
  `recusada`), `motivo_recusa`; o gestor do condomínio aprova ou recusa
- `vinculos`: quem acessa qual condomínio — `usuario_id`, `condominio_id`, `tipo`
  (`gestor`, `morador`, `funcionario`), `status` (`ativo`, `encerrado`), vigência
  (`inicio_vigencia`, `fim_vigencia`), `aprovado_por`, `encerrado_por`, `motivo_encerramento`;
  as unidades do morador ficam em `vinculos_imovel`
- `ocorrencias`: `condominio_id`, `registrado_por`, `local`, `descricao`, `status` (`novo`,
  `em_andamento`, `concluido`), `origem` (`aplicativo` para a do morador; `whatsapp`, `telefone`,
  `presencial` ou `vistoria` para a do gestor), `relatado_por` (opcional), e `urgencia_atual`, `categoria_atual` (preenchidas pela IA a
  partir da Sprint 2, com o histórico em `classificacoes_ia`)

Acesso a um condomínio = vínculo `ativo` e vigente (nas políticas, use
`public.eh_gestor_aprovado(condominio_id)`). Uma conta tem um tipo só. Gestor vê os
condomínios em que tem vínculo ativo; morador vê as
próprias ocorrências. O painel do gestor mostra todos os condomínios juntos; filtrar por um
condomínio é opcional, nunca a visão padrão.

## Convenções

- Textos da interface, mensagens de erro e comentários em **português**. Nomes de tabelas e
  colunas em português, sem acento (`ocorrencias`, `condominio_id`).
- **Branches**: base `develop`; trabalho em `feature/squad1-123-descricao` (o código vem da
  issue do Linear), com PR para a `develop`. Promoção sempre por PR: `develop → stage`
  (homologação) e `stage → prod` (produção, com tag `vX.Y.Z`). A `stage` só recebe da `develop`;
  a `prod` só recebe da `stage` ou de `hotfix/squad1-123-descricao`, que sai da `prod` e depois
  entra também na `develop`. Não existem `main` nem `release/`.
- **PR que depende de outra ainda aberta**: a branch sai da `develop` e traz a outra por
  `git merge`; a PR aponta para a `develop` (nunca para a branch da outra PR), como rascunho,
  com "Depende da #NN" no topo. Detalhes no `README.md`, seção "PR que depende de outra".
- **Conventional Commits** em português: `feat: tela de cadastro do gestor`.
- **Título de PR**: `tipo: descrição (SQUAD1-123)`, ex.: `feat: cadastro do gestor (SQUAD1-12)`.
  Vira a mensagem do merge commit na `develop` (merge comum, nunca squash: os commits da branch
  entram como estão, então cada um segue Conventional Commits). Preencha o template de PR, com
  prints se mudou tela.
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
