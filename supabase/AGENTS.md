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
`20261118210426_ocorrencia_pelo_gestor.sql`, `20261124174433_criar_funcionarios.sql`
(funcionários do condomínio), `20261124192621_status_delegado.sql` (status `delegado`),
`20261124200657_criar_delegacoes.sql` (delegação ao funcionário pelo link) e
`20261124201343_delegar_ocorrencia.sql` (o gestor delega e a troca de status revoga o link).

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
- `funcionarios` só é lida pelo gestor ativo do condomínio (morador, visitante e admin não leem) e
  só é escrita por `cadastrar_funcionario` e `desativar_funcionario`. Desativado continua na lista
  (`ativo = false`) e some da delegação; desativar não mexe em tarefas já delegadas. Edição e
  reativação ficam fora da Sprint 2: para "reativar", cadastre de novo.
- `delegacoes` só é lida pelo gestor ativo do condomínio, e nunca a coluna `token_hash`
  (morador, visitante e admin não leem). Não tem `insert`, `update` nem `delete` livres: a escrita
  é pelas funções do gestor (SQUAD1-74) e do link público (SQUAD1-75). Visitante não lê a tabela
  de jeito nenhum; a página do link usa só as funções.

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
| `registrar_ocorrencia_gestor(p_condominio_id, p_descricao, p_origem, p_local, p_relatado_por)` | gestor ativo do condomínio. Grava em nome de quem chama, com status `novo`. `p_origem`: `whatsapp`, `telefone`, `presencial` ou `vistoria`. `p_relatado_por` é opcional e precisa ser morador ou funcionário ativo do mesmo condomínio (vínculo do tipo `funcionario`, não a tabela `funcionarios`) |
| `encerrar_vinculo(p_vinculo_id, p_motivo)` | vínculo de gestor: admin; de morador ou funcionário: gestor do condomínio ou admin |
| `alterar_status_ocorrencia(p_ocorrencia_id, p_status)` | gestor ativo do condomínio. Muda só o status (`novo`, `em_andamento`, `concluido`; não aceita `delegado`, mas tira a ocorrência de `delegado`), preenche ou limpa `concluido_em`, grava em `historico_status` e **revoga a delegação ativa** ("assumir de volta") |
| `delegar_ocorrencia(p_ocorrencia_id, p_funcionario_id)` | gestor ativo do condomínio. O funcionário precisa estar ativo e ser do mesmo condomínio; a ocorrência não pode estar concluída. Revoga a delegação anterior (trocar o responsável é delegar de novo), cria a nova, muda o status para `delegado` (com histórico) e **devolve o token do link uma vez** (43 caracteres, base64url); o banco guarda só o hash |
| `cadastrar_funcionario(p_condominio_id, p_nome, p_celular, p_funcao)` | gestor ativo do condomínio. Devolve o `id`. `p_celular` só com dígitos (`5511999998888`; o front converte a máscara); nome até 120 e função até 60 caracteres (a função tira os espaços das pontas). Recusa celular já usado por um funcionário ativo do mesmo condomínio |
| `desativar_funcionario(p_funcionario_id)` | gestor ativo do condomínio do funcionário. Marca `ativo = false`; repetir não muda nada |

Ninguém aprova, recusa ou encerra o próprio pedido ou vínculo. Motivo é obrigatório na recusa e
no encerramento.

## Estado atual

A migração `20261116000000_profiles.sql` foi editada uma única vez (18/11) para trocar os papéis
por `admin`, `gestor` e `morador`. A partir daqui, vale a regra de nunca editar migração.
O front (`web/src/auth/`) ainda usa `sindico` e precisa ser ajustado para `gestor` e `admin`.
