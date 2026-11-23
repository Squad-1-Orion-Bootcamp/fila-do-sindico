import { Building2, LogOut } from 'lucide-react'
import { Link, Navigate, NavLink, useLocation } from 'react-router-dom'
import { useAuth, type Profile } from '../auth/AuthProvider'
import { CadastrosPendentes } from './CadastrosPendentes'
import { OcorrenciasDoGestor } from './OcorrenciasDoGestor'

// Telas provisórias. Cada uma vira uma história da sprint.

export function Topo() {
  const { profile, signOut } = useAuth()
  return (
    <header className="topo">
      <div className="topo-marca">
        <span className="topo-marca-icone">
          <Building2 size={20} aria-hidden />
        </span>
        Fila do Síndico
      </div>
      <span className="subtitulo">{profile?.nome}</span>
      {profile?.role === 'gestor' && (
        <nav className="topo-nav" aria-label="Painel do gestor">
          <NavLink className="botao" to="/quadro">
            Quadro
          </NavLink>
          <NavLink className="botao" to="/condominios">
            Condomínios
          </NavLink>
        </nav>
      )}
      <button className="botao" onClick={signOut}>
        <LogOut size={16} aria-hidden /> Sair
      </button>
    </header>
  )
}

export function QuadroOcorrencias() {
  return (
    <>
      <Topo />
      <main className="pagina">
        <div className="cabecalho-pagina">
          <div>
            <h1>Quadro de ocorrências</h1>
          </div>
          <Link to="/condominios" className="botao botao-principal">
            Cadastrar condomínio
          </Link>
        </div>
        <CadastrosPendentes />
        <OcorrenciasDoGestor />
      </main>
    </>
  )
}

type TextoSemAcesso = { titulo: string; explicacao: string }

const TEXTO_PADRAO: TextoSemAcesso = {
  titulo: 'Acesso ainda não liberado',
  explicacao: 'Peça ao gestor do seu condomínio para liberar seu acesso.',
}

function textoSemAcesso(profile: Profile | null): TextoSemAcesso {
  if (profile?.role === 'admin') {
    return {
      titulo: 'Conta de administrador',
      explicacao: 'Ainda não há tela de administrador: as aprovações são feitas pelo Studio.',
    }
  }
  switch (profile?.acesso?.situacao) {
    case 'pendente':
      return {
        titulo: 'Acesso ainda não liberado',
        explicacao: 'Seu cadastro está aguardando a aprovação do gestor do condomínio.',
      }
    case 'recusado':
      return {
        titulo: 'Cadastro recusado',
        explicacao: 'Seu cadastro foi recusado pelo gestor do condomínio.',
      }
    case 'encerrado':
      return {
        titulo: 'Acesso encerrado',
        explicacao: 'Seu acesso ao condomínio foi encerrado. Fale com o gestor.',
      }
    default:
      return TEXTO_PADRAO
  }
}

export function SemAcesso() {
  const { session, profile, loading, signOut } = useAuth()
  const texto = textoSemAcesso(profile)
  const location = useLocation()
  // Vem do pré-cadastro do morador, quando o cadastro já devolve sessão.
  const cadastroEnviado =
    (location.state as { cadastroEnviado?: boolean } | null)?.cadastroEnviado === true

  // Esta rota não passa pelo RequireRole: sem sessão (ex.: depois de "Sair"), volta ao login.
  if (!loading && !session) return <Navigate to="/login" replace />

  return (
    <main className="tela-centralizada">
      <div className="caixa">
        {cadastroEnviado && (
          <p
            role="status"
            className="aviso aviso-sucesso"
            style={{ marginBottom: 'var(--espaco-6)' }}
          >
            Cadastro enviado! O gestor do condomínio vai analisar seu pedido.
          </p>
        )}
        <h1>{texto.titulo}</h1>
        <p className="subtitulo" style={{ margin: 'var(--espaco-3) 0 var(--espaco-6)' }}>
          Você entrou com {session?.user.email}. {texto.explicacao}
        </p>
        {profile?.acesso?.situacao === 'recusado' && profile.acesso.motivoRecusa && (
          <p className="aviso aviso-erro" style={{ marginBottom: 'var(--espaco-6)' }}>
            Motivo: {profile.acesso.motivoRecusa}
          </p>
        )}
        <button className="botao botao-largo" onClick={signOut}>
          Sair
        </button>
      </div>
    </main>
  )
}
