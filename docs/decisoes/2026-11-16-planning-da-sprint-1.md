# Planning da Sprint 1

Data: 16/11/2026

## Produto e acesso

| Decisão | Motivo |
| --- | --- |
| Perfis: `admin`, `gestor` (síndico ou administradora) e `morador` | Os três papéis da plataforma |
| Uma conta tem um tipo só; quem é gestor e morador usa dois e-mails | Simplifica as permissões nesta versão |
| O papel fica em `profiles.role`, gravado pelo banco, nunca em `user_metadata` | O usuário consegue alterar `user_metadata` pelo navegador |
| Acesso a condomínios pela tabela `vinculos` (usuário, condomínio, tipo, status) | Um gestor tem vários condomínios; uma pessoa pode ter vários imóveis |
| Condomínio identificado pelo CNPJ, único | O mesmo prédio não é cadastrado duas vezes |
| Cadastro do gestor é público (nome, e-mail e senha); o vínculo com o condomínio que ele cadastra já nasce aprovado na Sprint 1 | Gestor novo começa com conta vazia e só vê o que cadastrar |
| Morador faz o pré-cadastro escolhendo o condomínio numa lista e escolhe a própria senha; acessa depois da aprovação do gestor | Tira trabalho do gestor; nunca enviar senha por e-mail |
| A lista pública de condomínios mostra só o nome, e só de condomínios com gestor aprovado | Nem todo morador está no grupo de WhatsApp; a aprovação barra pedidos indevidos |
| O gestor aprova ou recusa o cadastro, com motivo, sem alterar os dados; isso passa pelas funções `aprovar_solicitacao_vinculo` e `recusar_solicitacao_vinculo` | Quem preenche responde pelos dados; quem aprova responde pela aprovação |
| Toda ocorrência é registrada por usuário logado; não há formulário anônimo | Decisão da planning |
| O painel do gestor mostra as ocorrências de todos os seus condomínios juntas; filtrar por condomínio é opcional | A fila única é o diferencial do produto |
| Cada pessoa do time tem a própria conta de admin; na Sprint 1, aprovações de admin são feitas pelo Studio do Supabase | Saber quem fez cada ação; a tela de admin fica para depois |

## Escopo da Sprint 1 (17/11 a 21/11)

| Decisão | Motivo |
| --- | --- |
| Demo: gestor cria a conta → cadastra condomínio → morador se cadastra → gestor aprova → morador registra ocorrência → gestor vê a ocorrência | A banca quer ver o fluxo funcionando |
| Ficam para depois: ata do condomínio e comprovante do morador, tela de admin, vincular outro imóvel, cadastro de funcionário, ocorrência registrada pelo gestor (com quem relatou e canal de origem), anexos, e-mails e a classificação por IA | Capacidade de cerca de 3 h por dia por pessoa |
| O banco já nasce preparado para esses itens (tipo `funcionario`, colunas da IA) | Evita refazer o banco depois |
| Pedro dedica parte do tempo à Sprint 1 (triggers e revisão de RLS) e parte à preparação da IA | Mais capacidade na semana mais apertada sem atrasar a Sprint 2 |

## Técnica

| Decisão | Motivo |
| --- | --- |
| Design: CSS puro com variáveis (`web/src/styles/tokens.css`), guia em `web/DESIGN.md`, fonte Inter e ícones `lucide-react` | Segue a direção visual do protótipo; sem sintaxe nova para o time |
| Instruções para IA em `AGENTS.md` (Codex, Copilot e Claude Code), com skills e revisores em `.claude/` | O time usa ferramentas diferentes |
| Login por e-mail e senha; Google pode entrar depois | Já vem pronto no Supabase, sem configurar o Google Cloud |
| Confirmação de e-mail desligada no ambiente local; em produção, precisa estar ligada (com SMTP próprio) | O servidor de e-mail padrão do Supabase envia poucos e-mails por hora |
| Monorepo com `web/`, `ai-service/` e `supabase/` | Uma PR mostra front, IA e banco juntos |
| Front do zero (Vite + React + TS); o protótipo do Lovable serve de referência visual | Base limpa e conhecida pelo time |
| Serviço de IA em Python + FastAPI | É onde está a experiência de IA do time |
| Desenvolvimento com `docker compose` (front e IA com hot reload); Supabase pelo próprio CLI | Ambiente igual para todos; o CLI já roda o Supabase em Docker |
| Front em produção na Vercel, sem container | O front é estático; a Vercel faz build, HTTPS e preview por PR sem custo |
| Serviço de IA em produção como container (sem reload, sem root); onde hospedar fica para a Sprint 2 | É um servidor de verdade; a imagem é construída pelo CI |

## Substituídas

| Decisão antiga | Substituída por |
| --- | --- |
| Síndicos criados pelo time, sem tela de cadastro | Cadastro público do gestor |
| Síndico cadastra o morador e o morador cria a conta com esse e-mail | Pré-cadastro do morador com aprovação do gestor |
| Link de convite por condomínio | Lista pública de condomínios |
| Papéis `sindico` e `morador` | `admin`, `gestor` e `morador` |
| PRs de feature para a `develop` por squash merge | Merge commit em todas as PRs (17/11) |
| Quem abriu a PR faz o merge | Quem aprova a PR faz o merge (18/11) |
| Gitflow com `develop` como branch base; `main` só recebe releases (uma por sprint) e hotfixes | Branches `develop` → `stage` → `prod`, sem `main` nem `release/` (19/11) |
| `vinculos` com `unidade` e `status` `pendente`/`aprovado`/`recusado` | Pedido em `solicitacoes_vinculo`, vínculo `ativo`/`encerrado` com vigência e unidade em `imoveis` (18/11) |
| O funcionário é um morador com vínculo do tipo `funcionario`, com o mesmo acesso do morador (16/11) | Funcionário é um contato cadastrado pelo gestor, sem conta nem login, na tabela `funcionarios` (23/11) |
| Funcionário se cadastra como morador, por enquanto sem enviar documentação (18/11) | Funcionário é cadastrado pelo gestor na aba Funcionários, sem conta (23/11) |
