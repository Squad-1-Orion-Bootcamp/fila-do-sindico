# Branches e ambientes

Data: 19/11/2026

## Técnica

| Decisão | Motivo |
| --- | --- |
| Branches `develop` → `stage` → `prod`, sempre por PR e merge comum: a `stage` só recebe da `develop`, a `prod` só recebe da `stage` ou de `hotfix/`; a `main` e as `release/` deixam de existir | Orientação do mentor |
| Ao entrar na `prod`, a entrega ganha uma tag (`v0.1.0` na Sprint 1, `v0.2.0` na Sprint 2...) | Marca cada entrega no histórico |
| Hotfix sai da `prod`, entra por PR na `prod` e depois na `develop`; a `stage` recebe a correção na próxima promoção | A correção chega à demo sem esperar a próxima entrega e não se perde na `develop` |
| A workflow `origem-pr` recusa PR para a `stage` ou a `prod` vinda de origem não permitida; o título dispensa o código da issue só nas promoções | A regra do fluxo vale sem depender de alguém lembrar |
| Cada ambiente tem o próprio banco: `prod` no projeto atual do Supabase, `stage` num projeto novo, `develop` no banco local. A integração do Supabase com o GitHub aplica as migrações de cada projeto na branch do ambiente | Com um banco só, a `stage` rodaria código novo com o esquema antigo (ou a demo, código antigo com o esquema novo), e os testes da homologação gravariam nos dados da demo |
| Na Vercel, a `prod` é a Production Branch; a `stage` é um Preview com domínio fixo e variáveis apontando para o Supabase de stage | O plano Hobby não tem ambientes personalizados |
