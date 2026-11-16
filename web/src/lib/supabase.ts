import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Faltam VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY. Copie web/.env.example para web/.env.local e preencha.',
  )
}

// A chave anon é pública por design: quem protege os dados são as políticas de RLS no banco.
// Nunca use a service_role key no front.
export const supabase = createClient(url, anonKey)
