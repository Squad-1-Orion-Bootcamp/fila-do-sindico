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
`20261118050000_ajustes_revisao_rls.sql`, `20261118180436_registrar_ocorrencia.sql` e
`20261118191442_alterar_status_ocorrencia.sql` (gestor muda o status da ocorrência).

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
histórias que usam). Ocorrências não têm insert nem update livre: a ocorrência é criada só pela
função `registrar_ocorrencia` (descrição de até 800 caracteres) e a mudança de status passa por
`alterar_status_ocorrencia`.

### Acesso

- Acesso a um condomínio = vínculo `ativo` e vigente. Use `public.eh_gestor_aprovado(condominio_id)`
  nas políticas do gestor e `public.eh_admin_plataforma()` nas do admin.
- Vínculo encerrado perde o acesso na hora; a pessoa continua vendo o próprio vínculo (histórico).
- A lista pública de condomínios (`anon`) mostra só `id` e `nome`, e só de condomínios com gestor
  ativo: o front precisa usar `.select('id, nome')`.

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
| `encerrar_vinculo(p_vinculo_id, p_motivo)` | vínculo de gestor: admin; de morador ou funcionário: gestor do condomínio ou admin |
| `alterar_status_ocorrencia(p_ocorrencia_id, p_status)` | gestor ativo do condomínio. Muda só o status (`novo`, `em_andamento`, `concluido`), preenche ou limpa `concluido_em` e grava em `historico_status` |

Ninguém aprova, recusa ou encerra o próprio pedido ou vínculo. Motivo é obrigatório na recusa e
no encerramento.

## Estado atual

A migração `20261116000000_profiles.sql` foi editada uma única vez (18/11) para trocar os papéis
por `admin`, `gestor` e `morador`. A partir daqui, vale a regra de nunca editar migração.
O front (`web/src/auth/`) ainda usa `sindico` e precisa ser ajustado para `gestor` e `admin`.
