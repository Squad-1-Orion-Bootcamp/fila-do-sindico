---
name: nova-tela
description: Criar uma página no front (web/) com rota, proteção por perfil, leitura e escrita via Supabase e estados de carregando, erro e vazio. Use ao implementar qualquer tela nova.
---

# Nova tela no front

## 1. Confira a história

Liste os critérios de aceite da issue do Linear. Cada um vira algo verificável na tela.
Se faltar informação (campos, mensagens, quem acessa), pergunte antes de seguir.

## 2. Crie a página

Um arquivo por página em `web/src/pages/<NomeDaPagina>.tsx`.

```tsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Condominio = { id: string; nome: string }

export function Condominios() {
  const [itens, setItens] = useState<Condominio[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('condominios')
      .select('id, nome')
      .order('nome')
      .then(({ data, error }) => {
        if (error) {
          console.error(error)
          setErro('Não foi possível carregar os condomínios.')
        } else {
          setItens(data)
        }
        setLoading(false)
      })
  }, [])

  if (loading) return <p>Carregando…</p>
  if (erro) return <p role="alert" className="error">{erro}</p>
  if (itens.length === 0) return <p>Nenhum condomínio cadastrado ainda.</p>

  return (
    <ul>
      {itens.map((c) => (
        <li key={c.id}>{c.nome}</li>
      ))}
    </ul>
  )
}
```

- Use sempre o cliente de `src/lib/supabase.ts`.
- Selecione só as colunas que a tela usa.
- **Não filtre por usuário no front** para esconder dados de outros: o RLS já devolve só o
  permitido. Filtros no front são só de interface (ex.: "mostrar só o Condomínio Aurora").
- Escritas sensíveis chamam funções do banco: `supabase.rpc('aprovar_vinculo', { ... })`.

## 3. Registre a rota

Em `web/src/App.tsx`, proteja pelo perfil:

```tsx
<Route
  path="/condominios"
  element={
    <RequireRole role="gestor">
      <Condominios />
    </RequireRole>
  }
/>
```

Telas públicas (login, cadastro) ficam fora do `RequireRole`.

## 4. Formulários

- `required` e tipos de input corretos (`email`, `password`, `tel`).
- Botão desabilitado enquanto envia, com texto de progresso ("Salvando…").
- Mensagem de sucesso e de erro em português, sem detalhe técnico.
- Valide no front para ajudar o usuário, mas lembre que a regra de verdade está no banco.

## 5. Verifique

```bash
cd web && npm run lint && npm run build
```

Teste no navegador com **dois usuários diferentes** (ex.: gestor A e gestor B do seed) e
confira cada critério de aceite da história.
