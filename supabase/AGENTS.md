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

Migrações: `20261116000000_profiles.sql` (perfil), `20261118033000_modelo_de_dados.sql` (resto),
`20261118050000_ajustes_revisao_rls.sql`, `20261118180436_registrar_ocorrencia.sql`,
`20261118191442_alterar_status_ocorrencia.sql` (gestor muda o status da ocorrência),
`20261118210426_ocorrencia_pelo_gestor.sql`, `20261124035604_classificacao_ia.sql` (gatilho que
avisa o ai-service e gravação da classificação), `20261124041425_morador_sem_prioridade.sql`
(o morador não lê a prioridade nem a classificação), `20261124045005_gestor_altera_prioridade.sql`
(o gestor confirma ou muda a prioridade) e `20261125161720_classificar_pendentes.sql` (o painel
pede a classificação das ocorrências que ficaram sem prioridade).

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

Ainda não existem: `conversas` e `mensagens` (chat) e a escrita de anexos (entram com as
histórias que usam). A ocorrência é criada só pelas funções `registrar_ocorrencia` (morador) e
`registrar_ocorrencia_gestor` (descrição de até 800 caracteres), e o status muda só por
`alterar_status_ocorrencia`. `ocorrencias.origem` diz o canal (`aplicativo` para a do morador;
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

### Cadastro (`supabase.auth.signUp`, campo `options.data`)

| Campo | Gestor | Morador (e funcionário, por enquanto) |
| --- | --- | --- |
| `nome` | obrigatório | obrigatório |
| `tipo_cadastro` | `'gestor'` | `'morador'` |
| `condominio_id` | — | obrigatório (condomínio com gestor ativo) |
| `unidade` | — | obrigatório |

O trigger `handle_new_user` valida os campos, cria o perfil com o `role` e, para morador, a
solicitação de vínculo pendente. Campo faltando = o cadastro falha com a mensagem do erro.

### Funções chamadas pelo front (`supabase.rpc`)

| Função | Quem pode |
| --- | --- |
| `cadastrar_condominio(p_nome, p_cnpj)` | gestor. **Sprint 1:** cria o condomínio e o vínculo de gestor já ativo; CNPJ com 14 dígitos, único |
| `aprovar_solicitacao_condominio(p_solicitacao_id)` | admin. Para depois da Sprint 1, quando o cadastro passar pela análise do admin |
| `recusar_solicitacao_condominio(p_solicitacao_id, p_motivo)` | admin. Para depois da Sprint 1 |
| `aprovar_solicitacao_vinculo(p_solicitacao_id)` | gestor ativo do condomínio |
| `recusar_solicitacao_vinculo(p_solicitacao_id, p_motivo)` | gestor ativo do condomínio |
| `registrar_ocorrencia(p_descricao, p_local, p_condominio_id)` | morador (ou funcionário) com vínculo ativo. Grava em nome de quem chama, com status `novo`. `p_local` é opcional; `p_condominio_id` só é exigido de quem tem vínculo ativo em mais de um condomínio |
| `registrar_ocorrencia_gestor(p_condominio_id, p_descricao, p_origem, p_local, p_relatado_por)` | gestor ativo do condomínio. Grava em nome de quem chama, com status `novo`. `p_origem`: `whatsapp`, `telefone`, `presencial` ou `vistoria`. `p_relatado_por` é opcional e precisa ser morador ou funcionário ativo do mesmo condomínio |
| `encerrar_vinculo(p_vinculo_id, p_motivo)` | vínculo de gestor: admin; de morador ou funcionário: gestor do condomínio ou admin |
| `alterar_status_ocorrencia(p_ocorrencia_id, p_status)` | gestor ativo do condomínio. Muda só o status (`novo`, `em_andamento`, `concluido`), preenche ou limpa `concluido_em` e grava em `historico_status` |
| `definir_prioridade_ocorrencia(p_ocorrencia_id, p_urgencia, p_justificativa)` | gestor ativo do condomínio. Confirma ou muda a prioridade (`urgente`, `alta`, `normal` ou `baixa`); `p_justificativa` é opcional. Grava em `decisoes` (`acao = 'definir_prioridade'`) e atualiza `urgencia_atual`. Depois disso, a IA não muda mais a urgência. Não vale para ocorrência concluída |
| `classificar_pendentes()` | gestor com vínculo ativo em algum condomínio. Chamada pelo painel ao abrir, sem esperar a resposta. Se houver ocorrência sem prioridade criada há mais de 2 minutos, pede ao ai-service (`POST /classificar-pendentes`, pelo `pg_net`) que classifique até 20 delas; sem pendente, não chama nada. Não devolve dado nenhum |
| `listar_ocorrencias_gestor()` | qualquer usuário logado; devolve só as ocorrências dos condomínios em que quem chama é gestor ativo (para os outros, lista vazia), das mais novas para as mais antigas: `id`, `condominio_id`, `condominio_nome`, `local`, `descricao`, `status`, `urgencia_atual`, `categoria_atual`, `created_at`, `registrado_por_nome` |

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
