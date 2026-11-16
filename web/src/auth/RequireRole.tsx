import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth, type Role } from './AuthProvider'
import { homeFor } from './homeFor'

// Proteção só de navegação. Quem impede o acesso aos dados de verdade é o RLS no banco.
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { session, profile, loading } = useAuth()

  if (loading) return <p className="center">Carregando…</p>
  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <Navigate to="/sem-acesso" replace />
  if (profile.role !== role) return <Navigate to={homeFor(profile.role)} replace />
  return children
}
