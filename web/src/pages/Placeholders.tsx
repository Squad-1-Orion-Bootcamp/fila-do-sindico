import { useAuth } from '../auth/AuthProvider'

// Telas provisórias. Cada uma vira uma história da sprint.

function Header({ title }: { title: string }) {
  const { profile, signOut } = useAuth()
  return (
    <header className="header">
      <h1>{title}</h1>
      <span>{profile?.nome}</span>
      <button onClick={signOut}>Sair</button>
    </header>
  )
}

export function QuadroOcorrencias() {
  return (
    <main>
      <Header title="Quadro de Ocorrências" />
      <p>Em construção: fila priorizada de todos os condomínios do síndico.</p>
    </main>
  )
}

export function MinhasOcorrencias() {
  return (
    <main>
      <Header title="Minhas ocorrências" />
      <p>Em construção: registro de ocorrência e acompanhamento do status.</p>
    </main>
  )
}

export function SemAcesso() {
  const { signOut } = useAuth()
  return (
    <main className="card">
      <h1>Acesso ainda não liberado</h1>
      <p>Seu e-mail ainda não foi cadastrado por um síndico. Peça ao síndico do seu condomínio.</p>
      <button onClick={signOut}>Sair</button>
    </main>
  )
}
