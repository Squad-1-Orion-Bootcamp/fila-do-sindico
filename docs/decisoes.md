# Decisões do time

Registro curto das decisões, com o motivo. Decisão nova entra no topo da sua seção. Quando uma
decisão for trocada, mova a antiga para "Substituídas", dizendo o que a substituiu.

## 25/11/2026 — Justificativa pelo Gemini 2.5 Flash (SQUAD1-85)

### Técnica

| Decisão | Motivo |
| --- | --- |
| O System 2 (`ai-service/app/justificativa.py`) usa o Gemini 2.5 Flash pelo Pydantic AI, com saída estruturada (`frase`, de 1 a 200 caracteres) | Escolha do Pedro. A saída validada pelo schema evita parse de texto livre |
| O System 2 só explica a urgência final (depois da trava); não decide nem muda nada | Quem decide é o Decision 1, as regras ou a trava. A explicação nunca contradiz a etiqueta |
| O System 2 só é chamado quando o Decision 1 respondeu. Se ele falhou (ou a `LLM_API_KEY` está vazia), fica a frase da regra ou da trava | Com o Decision 1 fora, a Gemini provavelmente também está, e a chamada só gastaria até 8 s e cota. A frase da regra já diz qual palavra decidiu (decisão do Pedro) |
| Resposta inválida: pede de novo uma vez. Erro ou demora de mais de 8 s (contando a nova tentativa): fica o motivo padrão | A classificação nunca falha por causa da frase. O webhook roda em segundo plano, então 8 s não atrasam o gatilho |
| Sem "thinking" no 2.5 Flash (`thinking_budget = 0`) e temperatura 0,2 | O "thinking" vem ligado por padrão e só atrasa uma frase curta. Temperatura baixa deixa a frase presa aos fatos |

### Privacidade

| Decisão | Motivo |
| --- | --- |
| Vão para a Gemini só a descrição e o local da ocorrência. Nome, e-mail, unidade e condomínio nunca vão | Termos da Gemini API (em vigor desde 23/03/2026, <https://aistudio.google.com/docs/terms>): no plano grátis, o Google usa o que é enviado e as respostas "para melhorar e desenvolver" os produtos dele, e "revisores humanos podem ler" esse conteúdo. Os termos pedem para não enviar informação sensível, confidencial ou pessoal. No plano pago, o Google não usa os dados para melhorar produtos e só guarda registros por tempo limitado, contra abuso |

**Em aberto:** a descrição é texto livre do morador e pode conter dados pessoais (um nome, um
telefone). Vale também para o Decision 1 (SQUAD1-84), que manda o mesmo texto. Antes de usar
com moradores reais, o time decide entre o plano pago (projeto do Google Cloud com
faturamento) ou um aviso no formulário de ocorrência.

## 25/11/2026 — Trava de palavras de risco (SQUAD1-58)

Decidido pelo time, sem product builder no momento.

### Produto e acesso

| Decisão | Motivo |
| --- | --- |
| A trava força `urgente` com: gás (e "gases"), choque, elétrica, fumaça, vazamento grave, rachadura, fogo e incêndio. Sem diferenciar maiúsculas e acentos ("incendio" vale) e aceitando plural ("rachaduras", "choques", "vazamentos graves") | A lista do card (SQUAD1-58) mais fogo e incêndio, que são risco de vida. O plural é um jeito comum de escrever, e a trava existe para não deixar passar risco |
| Pessoa presa no elevador também força `urgente`: a descrição precisa ter "preso", "presa", "presos" ou "presas" **e** "elevador", em qualquer ordem | "Preso" sozinho daria falso urgente ("portão preso", "carro preso na garagem") |
| A trava olha só a descrição, nunca o local | Um local como "Sala elétrica" ou "Abrigo de gás" deixaria urgente toda ocorrência registrada ali |
| Quando a trava dispara, a justificativa cita o termo encontrado ("Trava de risco: a descrição menciona 'gás'.") | O gestor vê por que a ocorrência ficou urgente |

### Técnica

| Decisão | Motivo |
| --- | --- |
| A trava e as regras provisórias usam a mesma comparação por palavra inteira (`padrao_de_termo` em `app/trava.py`) | "gas" não casa com "gasto", "vagas" nem "desgaste", nem na trava nem nas regras |

## 24/11/2026 — Tabela de delegações (SQUAD1-73)

### Técnica

| Decisão | Motivo |
| --- | --- |
| O banco guarda só o hash (SHA-256) do token do link; a função de delegar devolve o token uma vez, para montar o link do WhatsApp. Para mandar de novo, o gestor delega de novo | Se a tabela vazar, nenhum link funciona. O front só precisa do token na hora de delegar (SQUAD1-76) |
| `delegacoes` tem `condominio_id` e chave composta com `ocorrencias` e com `funcionarios` | O banco garante que o funcionário é do mesmo condomínio da ocorrência, além da conferência na função (SQUAD1-74) |
| O comentário do funcionário tem até 800 caracteres e só existe na delegação concluída | Mesmo limite da descrição da ocorrência |

## 24/11/2026 — Status Delegado (SQUAD1-57)

### Produto e acesso

| Decisão | Motivo |
| --- | --- |
| A ocorrência tem quatro status: `novo`, `em_andamento`, `delegado` e `concluido`. `delegado` só vem da delegação para um funcionário (US 3); a troca manual do gestor continua entre os outros três | A US 1 pede as quatro colunas, e a US 3 diz que o status muda para Delegado ao delegar |
| O gestor pode tirar uma ocorrência de `delegado` trocando o status manualmente | A US 3 prevê que o síndico "assuma de volta" ou conclua; o link antigo deixa de valer (SQUAD1-74) |

## 24/11/2026 — Classificação pelo Gemini Decision 1 (SQUAD1-84)

### Produto e acesso

| Decisão | Motivo |
| --- | --- |
| Emergência com risco de vida (incêndio, fogo, pessoa presa no elevador) entra na trava e vira sempre `urgente` | Decisão do Lucas: o formulário vai avisar para ligar 193 ou 192 (card de front à parte), mas o morador pode ignorar o aviso, ou ligar e registrar também |

### Técnica

| Decisão | Motivo |
| --- | --- |
| O Gemini Decision 1 decide a urgência e a categoria; se ele der erro, demorar ou a `LLM_API_KEY` estiver vazia, as regras por palavra-chave decidem (origem `regra`). A trava vale nos dois casos (`ia+trava` ou `regra+trava`) | A ocorrência nunca fica sem prioridade, e a origem gravada mostra quantas vezes a IA respondeu (proposta da IA de 23/11) |
| Chamada ao Decision 1 com limite de cerca de 3 s e sem nova tentativa | Por padrão o SDK tenta de novo até 4 vezes, com espera de até 30 s; com o limite estourado, é melhor cair logo nas regras |
| `modelo_versao` é `gemini-decision-1` quando o Decision 1 decidiu e `regras-provisorias` quando as regras decidiram | Saber qual modelo classificou cada ocorrência |
| A confiança do Decision 1 vai só para o log; gravar no banco e sinalizar "revisar a prioridade" ficam para a Sprint 3 | Precisa de coluna nova (migração), fora do escopo da Sprint 2 |
| As urgências e as categorias, com a descrição de cada uma, ficam em `ai-service/app/contrato.py`; a lista ainda é proposta | O Pedro revisa na SQUAD1-56; no Decision 1, as descrições fazem o papel do prompt |

## 24/11/2026 — Webhook do ai-service (SQUAD1-63)

### Técnica

| Decisão | Motivo |
| --- | --- |
| O ai-service usa os valores de urgência do banco (`urgente`, `alta`, `normal`, `baixa`) também no `/classificar` | Contrato da SQUAD1-56; com `media`, o banco recusaria a gravação |
| O `/webhook` usa só o `id` do aviso: a descrição e o local vêm do banco, com a `service_role`, e a ocorrência já classificada é ignorada antes de chamar o classificador | Com o segredo vazado, ninguém muda a prioridade mandando outro texto; e o reenvio do gatilho não gasta a cota da Gemini (sugestões do `revisor-rls` na #24) |
| Com `WEBHOOK_SECRET` vazio no servidor, o `/webhook` recusa toda chamada (401) | Um servidor sem segredo configurado não pode aceitar qualquer chamada |

## 24/11/2026 — Gestor altera a prioridade (SQUAD1-60)

### Produto e acesso

| Decisão | Motivo |
| --- | --- |
| O motivo do gestor ao confirmar ou mudar a prioridade é opcional | Corrigir um falso urgente com um clique (SQUAD1-64); quando o gestor escreve, o motivo fica salvo |
| Confirmar a prioridade sugerida também conta como escolha do gestor: a IA não muda mais a urgência depois | A escolha do gestor sempre vence a IA e a trava (SQUAD1-56); a US 1 fala em "confirmar ou alterar" |
| A prioridade de uma ocorrência concluída não muda mais | Ela já saiu da fila; mudar não teria efeito |

### Técnica

| Decisão | Motivo |
| --- | --- |
| A escolha do gestor fica em `decisoes` com a ação nova `definir_prioridade`, e a IA confere essa tabela antes de mudar `urgencia_atual` | Usa a tabela de decisões que já existia, com autor, data e a sugestão da IA que foi confirmada ou corrigida, sem coluna nova em `ocorrencias` |

## 24/11/2026 — Classificação pela IA no banco (SQUAD1-59)

### Produto e acesso

| Decisão | Motivo |
| --- | --- |
| O morador não vê a prioridade nem o motivo da IA da própria ocorrência, só o status. Vale no banco, não só na tela: ele não lê `urgencia_atual`, `categoria_atual` nem `classificacoes_ia` pela API | Decisão do Lucas (SQUAD1-56); com a SQUAD1-59 esses dados passam a ser preenchidos |
| As decisões do gestor (`decisoes`: prioridade escolhida, justificativa, notas, destinatário) também são só do gestor ativo e do admin. Responde a SQUAD1-49 | Mesma regra: o morador vê só o status (SQUAD1-56 e US 3, em que o comentário do funcionário fica só para o síndico) |

### Técnica

| Decisão | Motivo |
| --- | --- |
| O banco avisa o ai-service por um gatilho com `pg_net` criado em migração, e não pelos "Database Webhooks" do painel | A regra 3 do `AGENTS.md`: toda mudança no banco é migração; o gatilho vai igual para local, stage e prod |
| O endereço do ai-service e o segredo do webhook ficam no Vault de cada banco, cadastrados à mão uma vez por ambiente | Cada ambiente tem o próprio ai-service, e a regra 6 proíbe segredo no código |
| O gatilho espera até 90 s pela resposta do ai-service (`timeout_milliseconds := 90000`) | No plano grátis, o Render dorme depois de 15 minutos sem uso e leva de 13 a 18 s para acordar; com 5 s, a primeira ocorrência depois de uma pausa nunca seria classificada. O `pg_net` é assíncrono, então o morador não espera (proposta e teste do Danilo na revisão da #24) |
| O gatilho nunca impede o registro da ocorrência: sem o Vault configurado ou com erro no `pg_net`, a ocorrência fica sem prioridade | Registrar a ocorrência é mais importante que classificá-la na hora; o "classificar pendentes" (SQUAD1-80) pega depois |
| `gravar_classificacao` só pode ser chamada pela `service_role`, e chamar de novo para a mesma ocorrência não muda nada | Só o ai-service grava a classificação; o `pg_net` e o "classificar pendentes" podem mandar a mesma ocorrência duas vezes |
| Cada classificação guarda a origem: `ia`, `regra`, `ia+trava` ou `regra+trava` | Mostra quantas vezes a IA respondeu e quantas vezes as regras assumiram (proposta da IA de 23/11) |
| O painel do gestor lê as ocorrências pela função `listar_ocorrencias_gestor()`, e não por `.from('ocorrencias')` | Gestor e morador usam o mesmo papel no banco, e permissão por coluna vale para o papel inteiro: para fechar `urgencia_atual` para o morador, a coluna sai da leitura direta de todos |

## 23/11/2026 — Funcionário (US 2)

### Produto e acesso

Decididas pelo Lucas em 23/11 (SQUAD1-67).

| Decisão | Motivo |
| --- | --- |
| O funcionário da delegação é um **contato cadastrado pelo gestor, sem conta nem login**, na tabela `funcionarios` (SQUAD1-69). Ele não usa `vinculos`, e o tipo `funcionario` de `vinculos` fica sem uso por enquanto | Decisão do Lucas: o funcionário só recebe a tarefa pelo link do WhatsApp e a conclui por ele (US 3), sem precisar de conta. Substitui a decisão de 16/11 de que o funcionário é um morador com vínculo do tipo `funcionario` |
| Os funcionários ficam numa aba própria, "Funcionários", com filtro por condomínio, no mesmo padrão visual do painel | Decisão do Lucas (SQUAD1-70) |
| O celular do funcionário tem DDD + 9 dígitos e é único por condomínio | Decisão do Lucas. Os detalhes vêm da implementação (SQUAD1-69): a unicidade vale entre os funcionários ativos, então o mesmo celular pode estar em outro condomínio (o zelador de dois prédios) e quem foi desativado pode ser cadastrado de novo; o banco guarda só os dígitos, no formato do WhatsApp (`5511999998888`), que é o que o link `wa.me` usa (SQUAD1-68) |

## 23/11/2026 — Link de delegação (US 3)

### Produto e acesso

Aprovadas pelo Lucas em 23/11 (SQUAD1-72).

| Decisão | Motivo |
| --- | --- |
| Desativar um funcionário **não** mexe no link de uma tarefa já delegada a ele | A tarefa já foi combinada com ele; desativar só tira o funcionário da lista na hora de delegar de novo |
| Qualquer troca de status pelo gestor (Novo, Em andamento ou Concluído) **revoga** o link ativo. "Assumir de volta" é isso, sem botão próprio | O gestor retoma a ocorrência pelo que já existe no painel, e o link antigo para de valer |
| O link **não expira** com o tempo: só deixa de valer quando a tarefa é concluída, quando o responsável é trocado ou quando o gestor muda o status | Tarefas de rotina podem levar dias; um prazo fixo derrubaria links ainda em uso |
| O comentário do funcionário ao concluir é visto **só pelo gestor**. O morador continua vendo apenas o status | Mesma regra da SQUAD1-56: o morador vê só o status |

## 23/11/2026 — Publicação do ai-service

### Técnica

| Decisão | Motivo |
| --- | --- |
| ai-service publicado no Render, plano grátis (SQUAD1-65) | Custo zero. O risco de o serviço dormir depois de 15 minutos sem uso é coberto pelo endpoint "classificar pendentes" (cartão a criar) |
| Dois serviços no Render, como na Vercel: um acompanha a `stage` (Supabase de stage), outro a `prod` (Supabase de produção). A `develop` não tem serviço: roda local | No Render, cada serviço acompanha uma branch só. Com o serviço na mesma branch do banco do ambiente, o código e o esquema sempre combinam. As 750 horas grátis são do workspace e serviço dormindo não gasta hora |
| Um `WEBHOOK_SECRET` diferente em cada ambiente | Se um vazar, o outro continua protegido |
| Sem `render.yaml`: a configuração do Render fica documentada no README | A documentação do Render não garante que um Blueprint assuma os serviços criados pelo painel sem criar outros |

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
| O funcionário é um morador com vínculo do tipo `funcionario`, com o mesmo acesso do morador (16/11) | Funcionário é um contato cadastrado pelo gestor, sem conta nem login, na tabela `funcionarios` (23/11) |
| Funcionário se cadastra como morador, por enquanto sem enviar documentação (18/11) | Funcionário é cadastrado pelo gestor na aba Funcionários, sem conta (23/11) |
