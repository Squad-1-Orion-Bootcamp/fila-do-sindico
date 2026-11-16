import type { Role } from './AuthProvider'

// Tela inicial de cada perfil depois do login.
export function homeFor(role: Role) {
  return role === 'sindico' ? '/quadro' : '/minhas-ocorrencias'
}
