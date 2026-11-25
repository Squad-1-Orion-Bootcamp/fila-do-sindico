# Funcionário (US 2)

Data: 23/11/2026

## Produto e acesso

Decididas pelo Lucas em 23/11 (SQUAD1-67).

| Decisão | Motivo |
| --- | --- |
| O funcionário da delegação é um **contato cadastrado pelo gestor, sem conta nem login**, na tabela `funcionarios` (SQUAD1-69). Ele não usa `vinculos`, e o tipo `funcionario` de `vinculos` fica sem uso por enquanto | Decisão do Lucas: o funcionário só recebe a tarefa pelo link do WhatsApp e a conclui por ele (US 3), sem precisar de conta. Substitui a decisão de 16/11 de que o funcionário é um morador com vínculo do tipo `funcionario` |
| Os funcionários ficam numa aba própria, "Funcionários", com filtro por condomínio, no mesmo padrão visual do painel | Decisão do Lucas (SQUAD1-70) |
| O celular do funcionário tem DDD + 9 dígitos e é único por condomínio | Decisão do Lucas. Os detalhes vêm da implementação (SQUAD1-69): a unicidade vale entre os funcionários ativos, então o mesmo celular pode estar em outro condomínio (o zelador de dois prédios) e quem foi desativado pode ser cadastrado de novo; o banco guarda só os dígitos, no formato do WhatsApp (`5511999998888`), que é o que o link `wa.me` usa (SQUAD1-68) |
