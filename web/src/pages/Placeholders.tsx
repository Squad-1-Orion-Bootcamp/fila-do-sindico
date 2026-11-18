import { Building2, LogOut } from 'lucide-react'
import { Link, Navigate, NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

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
            <p className="subtitulo">Ocorrências de todos os seus condomínios</p>
          </div>
          <Link to="/condominios" className="botao botao-principal">
            Cadastrar condomínio
          </Link>
        </div>
        <p className="estado-vazio">Em construção.</p>
      </main>
    </>
  )
}

export function MinhasOcorrencias() {
  return (
    <>
      <Topo />
      <main className="pagina-estreita">
        <h1>Minhas ocorrências</h1>
        <p className="estado-vazio">Em construção.</p>
      </main>
    </>
  )
}

export function SemAcesso() {
  const { session, loading, signOut } = useAuth()

  // Esta rota não passa pelo RequireRole: sem sessão (ex.: depois de "Sair"), volta ao login.
  if (!loading && !session) return <Navigate to="/login" replace />

  return (
    <main className="tela-centralizada">
      <div className="caixa">
        <h1>Acesso ainda não liberado</h1>
        <p className="subtitulo" style={{ margin: 'var(--espaco-3) 0 var(--espaco-6)' }}>
          Você entrou com {session?.user.email}. Peça ao gestor do seu condomínio para liberar
          seu acesso.
        </p>
        <button className="botao botao-largo" onClick={signOut}>
          Sair
        </button>
      </div>
    </main>
  )
}
