import { Building2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { homeFor } from '../auth/homeFor'

export function Login() {
  const { session, profile, loading, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session) {
    return <Navigate to={profile ? homeFor(profile.role) : '/sem-acesso'} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(await signIn(email, password))
    setSubmitting(false)
  }

  return (
    <main className="caixa">
      <div className="topo-marca" style={{ marginBottom: 'var(--espaco-6)' }}>
        <span className="topo-marca-icone">
          <Building2 size={20} aria-hidden />
        </span>
        Fila do Síndico
      </div>
      <form className="formulario" onSubmit={handleSubmit}>
        <label className="campo">
          <span className="campo-rotulo">E-mail</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="campo">
          <span className="campo-rotulo">Senha</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="aviso aviso-erro">
            {error}
          </p>
        )}
        <button type="submit" className="botao botao-principal botao-largo" disabled={submitting}>
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
