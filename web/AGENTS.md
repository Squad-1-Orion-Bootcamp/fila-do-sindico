# web/ — front (React + TypeScript + Vite)

Siga também o `AGENTS.md` da raiz.

## Comandos

```bash
npm run dev       # http://localhost:5173 (ou docker compose up na raiz)
npm run lint      # oxlint
npm run build     # checagem de tipos + build
```

## Estrutura

- `src/lib/supabase.ts` — único cliente Supabase. Importe daqui; não crie outro.
- `src/auth/AuthProvider.tsx` — sessão e perfil (`useAuth()` devolve `session`, `profile`,
  `loading`, `signIn`, `signOut`).
- `src/auth/RequireRole.tsx` — protege rotas por perfil.
- `src/auth/homeFor.ts` — tela inicial de cada perfil.
- `src/auth/cadastro.ts` — senha mínima, validação da senha e `criarConta()` dos cadastros.
- `src/pages/` — uma página por arquivo.
- `src/components/` — pedaços usados em mais de uma página (`MarcaCaixa`, `CamposDeAcesso`).
- `src/App.tsx` — todas as rotas.

## Design

- **Leia o `web/DESIGN.md` antes de criar ou mudar qualquer tela.** Ele define cores,
  tipografia, componentes e as classes CSS prontas.
- CSS puro. Cores, tamanhos, espaços e raios só via variáveis de `src/styles/tokens.css`;
  nunca um valor solto (`#0f766e`, `13px`) no código.
- Reaproveite as classes de `src/index.css` (`.botao`, `.campo`, `.cartao`, `.etiqueta-*`...).
  Estilo específico de uma tela vai num `.css` ao lado da página, ainda usando os tokens.
- Ícones: `lucide-react`. Fonte: Inter (já carregada).
- Referência visual: `docs/prototipo/`. Use para layout e visual; os campos seguem a história.

## Padrões

- Nova página: siga a skill `.claude/skills/nova-tela/SKILL.md`.
- Toda página que busca dados trata três estados: carregando, erro e lista vazia.
- Mensagens de erro para o usuário em português e sem detalhe técnico; o detalhe vai para o
  `console.error`.
- `RequireRole` só controla navegação. Nunca confie nele para esconder dados: quem garante o
  acesso é o RLS.
- Componentes de função com hooks. Sem biblioteca nova sem combinar com o time.
- Variáveis de ambiente começam com `VITE_` e precisam estar em `src/env.d.ts` e no
  `.env.example`.
