# Decisões do time

Registro curto das decisões, com o motivo. Decisão nova entra no topo da sua seção. Quando uma
decisão for trocada, mova a antiga para "Substituídas", dizendo o que a substituiu.

## 24/11/2026 — Status Delegado (SQUAD1-57)

### Produto e acesso

| Decisão | Motivo |
| --- | --- |
| A ocorrência tem quatro status: `novo`, `em_andamento`, `delegado` e `concluido`. `delegado` só vem da delegação para um funcionário (US 3); a troca manual do gestor continua entre os outros três | A US 1 pede as quatro colunas, e a US 3 diz que o status muda para Delegado ao delegar |
| O gestor pode tirar uma ocorrência de `delegado` trocando o status manualmente | A US 3 prevê que o síndico "assuma de volta" ou conclua; o link antigo deixa de valer (SQUAD1-74) |

## 19/11/2026 — Branches e ambientes

### Técnica

| Decisão | Motivo |
| --- | --- |
| Branches `develop` → `stage` → `prod`, sempre por PR e merge comum: a `stage` só recebe da `develop`, a `prod` só recebe da `stage` ou de `hotfix/`; a `main` e as `release/` deixam de existir | Orientação do mentor |
| Ao entrar na `prod`, a entrega ganha uma tag (`v0.1.0` na Sprint 1, `v0.2.0` na Sprint 2...) | Marca cada entrega no histórico |
| Hotfix sai da `prod`, entra por PR na `prod` e depois na `develop`; a `stage` recebe a correção na próxima promoção | A correção chega à demo sem esperar a próxima entrega e não se perde na `develop` |
| A workflow `origem-pr` recusa PR para a `stage` ou a `prod` vinda de origem não permitida; o título dispensa o código da issue só nas promoções | A regra do fluxo vale sem depender de alguém lembrar |
| Cada ambiente tem o próprio banco: `prod` no projeto atual do Supabase, `stage` num projeto novo, `develop` no banco local. A integração do Supabase com o GitHub aplica as migrações de cada projeto na branch do ambiente | Com um banco só, a `stage` rodaria código novo com o esquema antigo (ou a demo, código antigo com o esquema novo), e os testes da homologação gravariam nos dados da demo |
| Na Vercel, a `prod` é a Production Branch; a `stage` é um Preview com domínio fixo e variáveis apontando para o Supabase de stage | O plano Hobby não tem ambientes personalizados |

## 19/11/2026 — Filtro por condomínio no painel

### Produto e acesso

| Decisão | Motivo |
| --- | --- |
| O seletor "Mostrar" do quadro só aparece quando há ocorrências de mais de um condomínio (SQUAD1-31) | Com um condomínio só, o filtro não muda nada na lista |
| As opções do seletor saem das ocorrências carregadas: condomínio sem nenhuma ocorrência não aparece (SQUAD1-31) | A história pede o filtro no front, sobre o que o RLS já devolveu; filtrar um condomínio sem ocorrências daria uma lista vazia |

## 18/11/2026 — PRs dependentes

### Técnica

| Decisão | Motivo |
| --- | --- |
| PR que depende de outra ainda aberta aponta para a `develop` (a branch traz a outra por `git merge`), como rascunho e com "Depende da #NN"; nunca para a branch da outra PR | A #6 apontava para a branch da #2; a #2 entrou antes, a #6 foi mergeada nessa branch e o código não chegou à `develop` (foi preciso abrir a #11). Orientação do mentor |
| Quem aprova a PR faz o merge, seguindo a ordem das dependências | A pessoa que revisou sabe se a PR está pronta e em que ordem as PRs devem entrar |

## 18/11/2026 — Modelo de dados

### Produto e acesso

| Decisão | Motivo |
| --- | --- |
| Na Sprint 1, o gestor cadastra o condomínio (`cadastrar_condominio`) e já começa a usar; a análise do admin (`solicitacoes_condominio`) fica para depois | Mudança de última hora para a demo da Sprint 1 |
| O pedido do morador fica em `solicitacoes_vinculo` (`pendente`, `aprovada`, `recusada`); aprovado, vira um vínculo `ativo` com vigência, e a unidade vai para `imoveis` | Segue o documento "Modelo de dados da Fila do Síndico": pedido e acesso são coisas diferentes, e o histórico fica guardado |
| Vínculo de gestor só é encerrado pelo admin; de morador ou funcionário, pelo gestor do condomínio ou pelo admin. Ninguém encerra o próprio vínculo, e o motivo é obrigatório | Decisão do time |
| A ocorrência guarda o canal em `origem`: `aplicativo` (registrada pelo morador, o padrão), `whatsapp`, `telefone`, `presencial` ou `vistoria` (registrada pelo gestor) | Toda ocorrência tem origem, e dá para comparar os canais depois (SQUAD1-30) |
| Quem relatou ao gestor (`relatado_por`) é opcional e precisa ser morador ou funcionário ativo do condomínio; quem não tem conta fica em branco | Decisão do time (SQUAD1-30) |
| Quem sai do condomínio: o ex-morador continua vendo as ocorrências que registrou pelo app (histórico); o ex-gestor perde o acesso também às que ele registrou | Decisão do time; vínculo encerrado perde o acesso aos dados do condomínio (SQUAD1-30) |
| Funcionário se cadastra como morador, por enquanto sem enviar documentação | O cadastro de funcionário ficou para depois |
| Chat (`conversas` e `mensagens`) fica para o futuro | Fora do escopo das primeiras sprints |

### Técnica

| Decisão | Motivo |
| --- | --- |
| Tabelas, sequências e funções novas nascem sem acesso para `anon` e `authenticated`; cada migração dá os próprios `grant` | Nada fica exposto na API sem alguém liberar de propósito (apontado pelo `revisor-rls`) |
| Visitante (`anon`) lê só `id` e `nome` dos condomínios com gestor ativo; logado, cada pessoa vê só os condomínios em que tem vínculo ativo | O CNPJ e os demais dados não ficam públicos |

## 17/11/2026

### Técnica

| Decisão | Motivo |
| --- | --- |
| O template de PR não tem mais o item "Sei explicar todo o código desta PR"; a orientação continua no `AGENTS.md` | É uma caixa que todo mundo marca sem pensar; a garantia de verdade é a revisão humana obrigatória da PR |
| PRs entram por merge commit (merge comum), nunca squash, também na `develop`; cada commit da branch segue Conventional Commits e o título da PR vira a mensagem do merge commit | Mantém o histórico de commits e alterações; quando mais de uma pessoa colabora na mesma branch, nada do que cada uma fez é apagado |

## 16/11/2026 — Planning da Sprint 1

### Produto e acesso

| Decisão | Motivo |
| --- | --- |
| Perfis: `admin`, `gestor` (síndico ou administradora) e `morador`; o funcionário é um morador com vínculo do tipo `funcionario` | Funcionário com o mesmo acesso do morador evita trabalho extra agora |
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

### Escopo da Sprint 1 (17/11 a 21/11)

| Decisão | Motivo |
| --- | --- |
| Demo: gestor cria a conta → cadastra condomínio → morador se cadastra → gestor aprova → morador registra ocorrência → gestor vê a ocorrência | A banca quer ver o fluxo funcionando |
| Ficam para depois: ata do condomínio e comprovante do morador, tela de admin, vincular outro imóvel, cadastro de funcionário, ocorrência registrada pelo gestor (com quem relatou e canal de origem), anexos, e-mails e a classificação por IA | Capacidade de cerca de 3 h por dia por pessoa |
| O banco já nasce preparado para esses itens (tipo `funcionario`, colunas da IA) | Evita refazer o banco depois |
| Pedro dedica parte do tempo à Sprint 1 (triggers e revisão de RLS) e parte à preparação da IA | Mais capacidade na semana mais apertada sem atrasar a Sprint 2 |

### Técnica

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

### Substituídas

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
