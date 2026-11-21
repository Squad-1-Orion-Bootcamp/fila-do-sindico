import type { Profile, Role } from './AuthProvider'

// Tela inicial de cada perfil depois do login.
// O admin ainda não tem tela na Sprint 1 (as aprovações dele são feitas pelo Studio).
const TELA_INICIAL: Record<Role, string> = {
  admin: '/sem-acesso',
  gestor: '/quadro',
  morador: '/minhas-ocorrencias',
}

// O morador só entra com vínculo ativo; pendente, recusado ou encerrado fica em /sem-acesso.
export function acessoLiberado(profile: Profile) {
  return profile.role !== 'morador' || profile.acesso?.situacao === 'ativo'
}

export function homeFor(profile: Profile) {
  return acessoLiberado(profile) ? TELA_INICIAL[profile.role] : '/sem-acesso'
}
