# Decisões do time

Registro curto das decisões técnicas, com data e motivo. Decisão nova entra no topo.

## 16/11/2026 — Planning da Sprint 1

| Decisão | Motivo |
| --- | --- |
| Não há formulário público: toda ocorrência é registrada por usuário logado | Decisão da planning |
| Login por e-mail e senha na Sprint 1; Google pode entrar depois | Já vem pronto no Supabase, sem configurar o Google Cloud |
| Confirmação de e-mail desligada no ambiente local | O servidor de e-mail padrão do Supabase envia poucos e-mails por hora |
| Síndicos são criados pelo time (painel ou seed), sem tela de cadastro | Poucos síndicos na demo; evita que qualquer pessoa vire síndico |
| Papel do usuário fica na tabela `profiles`, protegida por RLS, e não em `user_metadata` | O usuário consegue alterar `user_metadata` pelo navegador |
| Morador cria a própria conta com o e-mail cadastrado pelo síndico; a conta é ligada ao cadastro pelo e-mail | O síndico não precisa criar senha para ninguém |
| Monorepo com `web/`, `ai-service/` e `supabase/` | Uma PR mostra front, IA e banco juntos |
| Front do zero (Vite + React + TS); o protótipo do Lovable serve de referência visual | Base limpa e conhecida pelo time |
| Serviço de IA em Python + FastAPI | É onde está a experiência de IA do time |
| Desenvolvimento com `docker compose` (front e IA com hot reload); Supabase pelo próprio CLI | Ambiente igual para todos; o CLI já roda o Supabase em Docker e cuida das migrações |
| Front em produção na Vercel, sem container; Docker do front só para desenvolvimento | O front é estático; a Vercel faz build, HTTPS, CDN e preview por PR sem custo |
| Serviço de IA em produção como container (sem reload, sem root) | É um servidor de verdade; a imagem é construída pelo CI a cada PR |
