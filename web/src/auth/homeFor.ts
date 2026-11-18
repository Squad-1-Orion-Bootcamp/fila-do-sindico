import type { Role } from './AuthProvider'

// Tela inicial de cada perfil depois do login.
// O admin ainda não tem tela na Sprint 1 (as aprovações dele são feitas pelo Studio).
const TELA_INICIAL: Record<Role, string> = {
  admin: '/sem-acesso',
  gestor: '/quadro',
  morador: '/minhas-ocorrencias',
}

export function homeFor(role: Role) {
  return TELA_INICIAL[role]
}
