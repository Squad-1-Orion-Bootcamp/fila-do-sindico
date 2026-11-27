# supabase/ — banco, Auth, Storage e RLS

Siga também o `AGENTS.md` da raiz.

## Comandos

```bash
npx supabase start                    # sobe o Supabase local (precisa de Docker)
npx supabase db reset                 # recria o banco: migrações + seed.sql
npx supabase migration new <nome>     # cria supabase/migrations/<timestamp>_<nome>.sql
npx supabase stop
```

Studio local: http://127.0.0.1:54323

## Regras

- Criar ou alterar tabela: siga `.claude/skills/nova-tabela/SKILL.md`.
- `decisoes`, `historico_status` e `classificacoes_ia` são só de inserção (gatilho da SQUAD1-91).
  Uma migração que precise mesmo corrigir dados nelas desativa o gatilho só dentro dela (`alter table ... disable trigger ...` e depois `enable always trigger ...`, nunca só `enable`, que tira a proteção contra o modo `replica`) e explica o motivo.
- Tabela que o ai-service lê pela API REST precisa de `grant select ... to service_role` na migração.
  Projetos novos do Supabase não dão esse acesso por padrão (SQUAD1-94).
- Toda tabela em `public` tem `enable row level security` e políticas explícitas para cada
  operação que o front usa.
- Use `(select auth.uid())` nas políticas (avaliado uma vez por consulta, não por linha).
- Funções `security definer` sempre com `set search_path = ''` e nomes qualificados
  (`public.vinculos`), e validando quem chama.
- Nada de dados reais no `seed.sql`: só dados de teste.
- O admin não tem tela na Sprint 1: aprovações de admin são feitas pelo Studio, por um membro
  do time com login próprio. No SQL Editor, use "impersonate" com a sua conta de admin e chame
  a função (ex.: `select public.aprovar_solicitacao_condominio('<id>');`): as funções conferem
  quem chama por `auth.uid()`, então rodar como `postgres` não funciona.
- Novo admin: inclua a conta em `public.administradores_plataforma` pelo Studio. O trigger
  `administradores_definir_papel` muda `profiles.role` para `admin`.

## Modelo de dados

As migrações ficam em `supabase/migrations/`, em ordem de data.
Cada uma começa com um comentário dizendo o que faz e a issue
(`grep -m1 '^--' supabase/migrations/*.sql` lista todas).
Não liste migrações aqui: toda PR com migração mexeria no mesmo parágrafo.

| Tabela | Para quê |
| --- | --- |
| `profiles` | Perfil 1:1 com `auth.users`. `role` (`admin`, `gestor`, `morador`) gravado pelo banco |
| `administradores_plataforma` | Contas de admin, uma por pessoa do time |
| `solicitacoes_condominio` | Pedido do gestor para cadastrar um condomínio, analisado pelo admin. Não usado na Sprint 1 (o gestor cadastra direto) |
| `condominios`, `imoveis` | Cadastro permanente do condomínio e das unidades |
| `vinculos` | Quem acessa qual condomínio (`gestor`, `morador`, `funcionario`), `status` `ativo`/`encerrado`, vigência, quem aprovou e quem encerrou |
| `vinculos_imovel` | Unidades de cada vínculo (morador pode ter mais de uma) |
| `solicitacoes_vinculo` | Pré-cadastro do morador (criado pelo cadastro); o gestor do condomínio aprova ou recusa |
| `documentos_comprobatorios` | Comprovantes no bucket privado `documentos`, caminho `<uid>/<arquivo>` |
| `ocorrencias`, `anexos`, `classificacoes_ia`, `decisoes`, `historico_status` | Ocorrências, arquivos, sugestões da IA, decisões e mudanças de status |
| `funcionarios` | Contatos dos funcionários de cada condomínio, **sem conta nem login**, cadastrados pelo gestor para a delegação: `nome`, `celular` (só dígitos, `55` + DDD + 9 dígitos), `funcao` (texto livre), `ativo`, `criado_por`. Celular único entre os ativos do mesmo condomínio. Não usa `vinculos` |
| `delegacoes` | Ocorrências delegadas a funcionários (US 3): `ocorrencia_id`, `condominio_id`, `funcionario_id` (do mesmo condomínio, garantido por chave composta), `situacao` (`ativa`, `concluida`, `revogada`), `comentario` do funcionário (até 800, só na conclusão), `criado_por` e as datas. Guarda só o hash do token (`token_hash`, SHA-256); o token puro nunca é gravado. Só uma delegação ativa por ocorrência |

Ainda não existem: `conversas` e `mensagens` (chat) e a escrita de anexos (entram com as
histórias que usam). A ocorrência é criada só pelas funções `registrar_ocorrencia` (morador) e
`registrar_ocorrencia_gestor` (descrição de até 800 caracteres), e o status muda só por
`alterar_status_ocorrencia`. O status é `novo`, `em_andamento`, `delegado` ou `concluido`;
`delegado` só vem da delegação para um funcionário (US 3), nunca da troca manual.
`ocorrencias.origem` diz o canal (`aplicativo` para a do morador;
`whatsapp`, `telefone`, `presencial` ou `vistoria` para a do gestor) e `relatado_por`, opcional,
aponta para o morador que relatou ao gestor.

### Acesso

- Acesso a um condomínio = vínculo `ativo` e vigente. Use `public.eh_gestor_aprovado(condominio_id)`
  nas políticas do gestor e `public.eh_admin_plataforma()` nas do admin.
- Vínculo encerrado perde o acesso na hora; a pessoa continua vendo o próprio vínculo (histórico).
  O ex-morador continua vendo as ocorrências que registrou pelo app (`origem = 'aplicativo'`);
  a ocorrência registrada pelo gestor só é vista por quem tem vínculo ativo.
  Toda função nova que grave ocorrência precisa manter isso: `origem = 'aplicativo'` só para
  ocorrência registrada por morador.
- A lista pública de condomínios (`anon`) mostra só `id` e `nome`, e só de condomínios com gestor
  ativo: o front precisa usar `.select('id, nome')`.
- O morador não vê a prioridade nem o motivo da IA, só o status. `urgencia_atual` e
  `categoria_atual` ficam fora da leitura direta de `ocorrencias` para todo usuário logado
  (permissão por coluna vale para o papel inteiro), e `classificacoes_ia` e `decisoes` só são
  lidas pelo gestor ativo e pelo admin. O painel do gestor lê a lista com a prioridade pela função
  `listar_ocorrencias_gestor()`. Um `.select('*')` ou com `urgencia_atual` em `ocorrencias` dá erro
  de permissão.
- `ocorrencias` é liberada por coluna para `authenticated`: coluna nova que o front precise ler
  entra na migração com `grant select (coluna) on public.ocorrencias to authenticated`.
- `funcionarios` só é lida pelo gestor ativo do condomínio (morador, visitante e admin não leem) e
  só é escrita por `cadastrar_funcionario` e `desativar_funcionario`. Desativado continua na lista
  (`ativo = false`) e some da delegação; desativar não mexe em tarefas já delegadas. Edição e
  reativação ficam fora da Sprint 2: para "reativar", cadastre de novo.
- `delegacoes` só é lida pelo gestor ativo do condomínio, e nunca a coluna `token_hash`
  (morador, visitante e admin não leem). Não tem `insert`, `update` nem `delete` livres: a escrita
  é pelas funções do gestor (SQUAD1-74) e do link público (SQUAD1-75). Visitante não lê a tabela
  de jeito nenhum; a página do link usa só as funções.

### Cadastro (`supabase.auth.signUp`, campo `options.data`)

| Campo | Gestor | Morador |
| --- | --- | --- |
| `nome` | obrigatório | obrigatório |
| `tipo_cadastro` | `'gestor'` | `'morador'` |
| `condominio_id` | — | obrigatório (condomínio com gestor ativo) |
| `unidade` | — | obrigatório |

O trigger `handle_new_user` valida os campos, cria o perfil com o `role` e, para morador, a
solicitação de vínculo pendente. Campo faltando = o cadastro falha com a mensagem do erro.

### Funções chamadas pelo front (`supabase.rpc`)

Em ordem alfabética: a função nova entra no lugar dela, não no fim.

| Função | Quem pode |
| --- | --- |
| `alterar_status_ocorrencia(p_ocorrencia_id, p_status)` | gestor ativo do condomínio. Muda só o status (`novo`, `em_andamento`, `concluido`; não aceita `delegado`, mas tira a ocorrência de `delegado`), preenche ou limpa `concluido_em`, grava em `historico_status` e **revoga a delegação ativa** ("assumir de volta") |
| `aprovar_solicitacao_condominio(p_solicitacao_id)` | admin. Para depois da Sprint 1, quando o cadastro passar pela análise do admin |
| `aprovar_solicitacao_vinculo(p_solicitacao_id)` | gestor ativo do condomínio |
| `cadastrar_condominio(p_nome, p_cnpj)` | gestor. **Sprint 1:** cria o condomínio e o vínculo de gestor já ativo; CNPJ com 14 dígitos, único |
| `cadastrar_funcionario(p_condominio_id, p_nome, p_celular, p_funcao)` | gestor ativo do condomínio. Devolve o `id`. `p_celular` só com dígitos (`5511999998888`; o front converte a máscara); nome até 120 e função até 60 caracteres (a função tira os espaços das pontas). Recusa celular já usado por um funcionário ativo do mesmo condomínio |
| `classificar_pendentes()` | gestor com vínculo ativo em algum condomínio. Chamada pelo painel ao abrir, sem esperar a resposta. Se houver ocorrência sem prioridade criada há mais de 2 minutos, pede ao ai-service (`POST /classificar-pendentes`, pelo `pg_net`) que classifique até 20 delas; sem pendente, não chama nada. No máximo um pedido por minuto, somando todos os gestores (`private.classificar_pendentes_controle`). Não devolve dado nenhum |
| `concluir_tarefa(p_token, p_comentario)` | quem tem o link (`anon` ou `authenticated`). Exige delegação ativa e ocorrência `delegado`, trava a ocorrência antes de revalidar o token, limita comentário a 800 caracteres (só espaços vira nulo), conclui ocorrência e delegação e grava histórico com `autor_id` nulo. Link que não vale mais: "Esta tarefa já foi encerrada." ou "Esta tarefa não está mais atribuída a você." |
| `definir_prioridade_ocorrencia(p_ocorrencia_id, p_urgencia, p_justificativa)` | gestor ativo do condomínio. Confirma ou muda a prioridade (`urgente`, `alta`, `normal` ou `baixa`); `p_justificativa` é opcional. Grava em `decisoes` (`acao = 'definir_prioridade'`) e atualiza `urgencia_atual`. Depois disso, a IA não muda mais a urgência. Não vale para ocorrência concluída |
| `delegar_ocorrencia(p_ocorrencia_id, p_funcionario_id)` | gestor ativo do condomínio. O funcionário precisa estar ativo e ser do mesmo condomínio; a ocorrência não pode estar concluída. Revoga a delegação anterior (trocar o responsável é delegar de novo), cria a nova, muda o status para `delegado` (com histórico) e **devolve o token do link uma vez** (43 caracteres, base64url); o banco guarda só o hash |
| `desativar_funcionario(p_funcionario_id)` | gestor ativo do condomínio do funcionário. Marca `ativo = false`; repetir não muda nada |
| `encerrar_vinculo(p_vinculo_id, p_motivo)` | vínculo de gestor: admin; de morador ou funcionário: gestor do condomínio ou admin |
| `listar_ocorrencias_gestor()` | qualquer usuário logado; devolve só as ocorrências dos condomínios em que quem chama é gestor ativo (para os outros, lista vazia), das mais novas para as mais antigas: `id`, `condominio_id`, `condominio_nome`, `local`, `descricao`, `status`, `urgencia_atual`, `categoria_atual`, `created_at`, `registrado_por_nome`, `concluido_em` |
| `recusar_solicitacao_condominio(p_solicitacao_id, p_motivo)` | admin. Para depois da Sprint 1 |
| `recusar_solicitacao_vinculo(p_solicitacao_id, p_motivo)` | gestor ativo do condomínio |
| `registrar_ocorrencia(p_descricao, p_local, p_condominio_id)` | morador (ou funcionário) com vínculo ativo. Grava em nome de quem chama, com status `novo`. `p_local` é opcional; `p_condominio_id` só é exigido de quem tem vínculo ativo em mais de um condomínio |
| `registrar_ocorrencia_gestor(p_condominio_id, p_descricao, p_origem, p_local, p_relatado_por)` | gestor ativo do condomínio. Grava em nome de quem chama, com status `novo`. `p_origem`: `whatsapp`, `telefone`, `presencial` ou `vistoria`. `p_relatado_por` é opcional e precisa ser morador ou funcionário ativo do mesmo condomínio (vínculo do tipo `funcionario`, não a tabela `funcionarios`) |
| `ver_tarefa(p_token)` | quem tem o link (`anon` ou `authenticated`). Devolve a situação: `ativa` com nome do condomínio, local e descrição; `concluida` ou `revogada` sem dados da tarefa. Token inválido ou inexistente resulta em lista vazia |

Ninguém aprova, recusa ou encerra o próprio pedido ou vínculo. Motivo é obrigatório na recusa e
no encerramento.

### Classificação pela IA

- O gatilho `classificar_ocorrencia` (`after insert` em `ocorrencias`) chama
  `private.avisar_ai_service()`, que envia `{id, descricao, local}` para `<ai_service_url>/webhook`
  pelo `pg_net`, com o cabeçalho `X-Webhook-Secret`. Nada de quem registrou sai do banco.
- `ai_service_url` e `ai_webhook_secret` ficam no Vault de cada banco (passo a passo no
  `README.md` da raiz). Sem eles, ou se o `pg_net` falhar, a ocorrência é registrada normalmente
  e fica sem prioridade ("Aguardando triagem"). A rede de segurança é `classificar_pendentes()`,
  que o painel do gestor chama ao abrir (mesmo Vault e mesmo segredo, rota
  `<ai_service_url>/classificar-pendentes`).
- O schema `private` guarda funções internas: sem acesso para `anon` e `authenticated` e fora da API.
- O Supabase dá a `anon` e `authenticated` acesso ao schema `net` do `pg_net`, onde o segredo fica
  até o envio, e uma migração não consegue tirar. Ele só fica protegido porque a API não expõe `net`:
  nunca inclua `net` ou `extensions` nos schemas da API (`config.toml` ou painel).

| Função | Quem pode |
| --- | --- |
| `gravar_classificacao(p_ocorrencia_id, p_urgencia, p_categoria, p_justificativa, p_origem, p_modelo_versao)` | só a `service_role` (o ai-service; o front nunca chama). `p_urgencia`: `urgente`, `alta`, `normal` ou `baixa`. `p_origem`: `ia`, `regra`, `ia+trava` ou `regra+trava`. `p_modelo_versao` é opcional. Grava o histórico em `classificacoes_ia` (`status_processamento = 'sucesso'`) e atualiza `categoria_atual` e `urgencia_atual`; se o gestor já definiu a prioridade (`definir_prioridade_ocorrencia`), a urgência dele fica. Se a ocorrência já foi classificada, devolve a classificação existente sem mudar nada |

## Estado atual

A migração `20261116000000_profiles.sql` foi editada uma única vez (18/11) para trocar os papéis
por `admin`, `gestor` e `morador`. A partir daqui, vale a regra de nunca editar migração.
O front (`web/src/auth/`) ainda usa `sindico` e precisa ser ajustado para `gestor` e `admin`.
