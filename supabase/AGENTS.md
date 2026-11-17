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
  do time com login próprio.

## Estado atual

A migração `20261116000000_profiles.sql` ainda aceita `role` igual a `sindico` ou `morador`.
Pela decisão de 16/11, os valores passam a ser `admin`, `gestor` e `morador`. Como o banco ainda
não foi aplicado em nenhum ambiente compartilhado, essa migração pode ser editada uma única vez
para isso (junto com `web/src/auth/`). Depois disso, a regra de nunca editar migração vale.
