---
name: nova-tabela
description: Criar ou alterar uma tabela no Supabase com migração, RLS, políticas, seed e teste de isolamento. Use sempre que a tarefa mexer no esquema do banco.
---

# Nova tabela (ou alteração de tabela)

## 1. Entenda o acesso antes de escrever SQL

Responda, para cada perfil (`gestor`, `morador`, `admin`):
- Pode **ler** quais linhas? Pode **criar**? **Alterar**? **Apagar**?
- O acesso depende de um vínculo ativo com o condomínio?

Se a história não responde, pergunte antes de seguir.

## 2. Crie a migração

```bash
npx supabase migration new criar_<tabela>
```

Nunca edite uma migração já aplicada em outro ambiente: crie uma nova.

## 3. Escreva a tabela com RLS desde o início

```sql
create table public.<tabela> (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios (id) on delete cascade,
  -- colunas...
  created_at timestamptz not null default now()
);

alter table public.<tabela> enable row level security;

create index on public.<tabela> (condominio_id);
```

- Nomes em português, sem acento, em `snake_case`.
- Valores fixos com `check (coluna in ('a', 'b'))`.
- Toda chave estrangeira usada em política ganha índice.

## 4. Escreva uma política por operação

Modelo para "gestor com vínculo ativo no condomínio". A função `eh_gestor_aprovado` já confere
`tipo = 'gestor'`, `status = 'ativo'` e a vigência (`inicio_vigencia` e `fim_vigencia`):

```sql
create policy "gestor le <tabela> dos seus condominios"
  on public.<tabela> for select
  to authenticated
  using (public.eh_gestor_aprovado(condominio_id));
```

Para o admin, acrescente `or (select public.eh_admin_plataforma())`.

- `insert` usa `with check`; `update` usa `using` e `with check`.
- Sem política para uma operação = operação proibida. Isso é o desejado para o que o front
  não deve fazer.
- Escrita sensível (mudar status, papel, aprovação): não crie política de `update`; crie uma
  função `security definer` com `set search_path = ''` que valide quem chama.

## 5. Dê os `grant` que o front usa

Tabelas, sequências e funções novas nascem **sem acesso** para `anon` e `authenticated`
(migração `20261118050000_ajustes_revisao_rls.sql`). Sem `grant`, o front recebe
`permission denied`, mesmo com a política certa. Dê só o que a tela usa:

```sql
grant select on public.<tabela> to authenticated;
grant insert (condominio_id, coluna_a) on public.<tabela> to authenticated;  -- só as colunas que o front envia
grant execute on function public.<funcao>(<tipos>) to authenticated;
```

`grant` libera a operação; a política de RLS decide quais linhas. Os dois são necessários.

## 6. Atualize o seed

Em `supabase/seed.sql`, inclua linhas de teste para **dois gestores diferentes**, para o teste
de isolamento ter o que comparar.

## 7. Aplique e teste o isolamento

```bash
npx supabase db reset
```

No SQL Editor do Studio (http://127.0.0.1:54323), simule cada usuário:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<uuid-do-gestor-A>","role":"authenticated"}', true);
select * from public.<tabela>;   -- deve trazer só linhas dos condomínios do gestor A
rollback;
```

Repita com o gestor B e com um morador. Teste também que uma escrita proibida falha.

## 8. Antes da PR

- Peça a revisão do agente `revisor-rls` (ou peça a um colega para seguir o checklist dele).
- Atualize o `supabase/AGENTS.md` (e o resumo no `AGENTS.md` da raiz) se o modelo de dados mudou.
- Registre em `docs/decisoes.md` qualquer regra de acesso nova.
