# Publicação do ai-service

Data: 23/11/2026

## Técnica

| Decisão | Motivo |
| --- | --- |
| ai-service publicado no Render, plano grátis (SQUAD1-65) | Custo zero. O risco de o serviço dormir depois de 15 minutos sem uso é coberto pelo endpoint "classificar pendentes" (cartão a criar) |
| Dois serviços no Render, como na Vercel: um acompanha a `stage` (Supabase de stage), outro a `prod` (Supabase de produção). A `develop` não tem serviço: roda local | No Render, cada serviço acompanha uma branch só. Com o serviço na mesma branch do banco do ambiente, o código e o esquema sempre combinam. As 750 horas grátis são do workspace e serviço dormindo não gasta hora |
| Um `WEBHOOK_SECRET` diferente em cada ambiente | Se um vazar, o outro continua protegido |
| Sem `render.yaml`: a configuração do Render fica documentada no README | A documentação do Render não garante que um Blueprint assuma os serviços criados pelo painel sem criar outros |
