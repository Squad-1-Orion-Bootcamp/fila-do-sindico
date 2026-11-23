import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth, type Role } from './AuthProvider'
import { acessoLiberado, homeFor } from './homeFor'

// Proteção só de navegação. Quem impede o acesso aos dados de verdade é o RLS no banco.
export function RequireRole({ role, children }: Readonly<{ role: Role; children: ReactNode }>) {
  const { session, profile, loading } = useAuth()

  if (loading) return <p className="estado-vazio">Carregando…</p>
  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <Navigate to="/sem-acesso" replace />
  // Papel errado, ou morador sem vínculo ativo: vai para a tela certa dele.
  if (profile.role !== role || !acessoLiberado(profile)) {
    return <Navigate to={homeFor(profile)} replace />
  }
  return children
}
