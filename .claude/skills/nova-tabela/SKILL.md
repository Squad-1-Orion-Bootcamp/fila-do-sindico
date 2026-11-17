---
name: nova-tabela
description: Criar ou alterar uma tabela no Supabase com migração, RLS, políticas, seed e teste de isolamento. Use sempre que a tarefa mexer no esquema do banco.
---

# Nova tabela (ou alteração de tabela)

## 1. Entenda o acesso antes de escrever SQL

Responda, para cada perfil (`gestor`, `morador`, `admin`):
- Pode **ler** quais linhas? Pode **criar**? **Alterar**? **Apagar**?
- O acesso depende de um vínculo aprovado com o condomínio?

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

Modelo para "gestor com vínculo aprovado no condomínio":

```sql
create policy "gestor le <tabela> dos seus condominios"
  on public.<tabela> for select
  to authenticated
  using (
    exists (
      select 1 from public.vinculos v
      where v.condominio_id = <tabela>.condominio_id
        and v.usuario_id = (select auth.uid())
        and v.tipo = 'gestor'
        and v.status = 'aprovado'
    )
  );
```

- `insert` usa `with check`; `update` usa `using` e `with check`.
- Sem política para uma operação = operação proibida. Isso é o desejado para o que o front
  não deve fazer.
- Escrita sensível (mudar status, papel, aprovação): não crie política de `update`; crie uma
  função `security definer` com `set search_path = ''` que valide quem chama.

## 5. Atualize o seed

Em `supabase/seed.sql`, inclua linhas de teste para **dois gestores diferentes**, para o teste
de isolamento ter o que comparar.

## 6. Aplique e teste o isolamento

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

## 7. Antes da PR

- Peça a revisão do agente `revisor-rls` (ou peça a um colega para seguir o checklist dele).
- Atualize o `AGENTS.md` da raiz se o modelo de dados mudou.
- Registre em `docs/decisoes.md` qualquer regra de acesso nova.
