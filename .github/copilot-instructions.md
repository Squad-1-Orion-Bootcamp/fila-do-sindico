# Instruções para o GitHub Copilot

As instruções completas do projeto estão em `AGENTS.md` (raiz) e no `AGENTS.md` de cada pasta.
Leia esses arquivos antes de sugerir mudanças. As regras abaixo valem também para revisões de
código feitas pelo Copilot.

## Regras que não podem ser quebradas

1. Nunca usar a `service_role` key do Supabase no front (`web/`).
2. O papel do usuário fica em `profiles.role` (`admin`, `gestor`, `morador`); nunca em
   `user_metadata`.
3. Mudança no banco = migração nova em `supabase/migrations/`; nunca editar migração já aplicada.
4. Toda tabela nova com RLS ligado e políticas; sinalize qualquer política que permita a um
   gestor ver dados de condomínio sem vínculo aprovado.
5. Escritas sensíveis (aprovar vínculo, mudar papel) só por funções do banco.
6. Nenhuma chave ou senha no código.

## Em revisões de PR, verifique

- A PR aponta para `develop` e o nome da branch segue `feature/squad1-123-descricao`.
- Textos de interface em português.
- Lint e testes da pasta alterada passando.
- README atualizado quando muda tabela, rota ou variável de ambiente.
