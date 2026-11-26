import { useAuth } from './AuthProvider'
import { homeFor } from './homeFor'

// Login e cadastros: quem já está logado vai para a própria tela inicial.
// Devolve o destino, ou null enquanto carrega ou sem sessão.
export function useRedirecionarLogado() {
  const { session, profile, loading } = useAuth()
  if (loading || !session) return null
  return profile ? homeFor(profile) : '/sem-acesso'
}
