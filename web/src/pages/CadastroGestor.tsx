import { Building2 } from 'lucide-react'
import { useState, type SubmitEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { homeFor } from '../auth/homeFor'
import { supabase } from '../lib/supabase'

const SENHA_MINIMA = 6 // igual ao minimum_password_length do Supabase

export function CadastroGestor() {
  const { session, profile, loading } = useAuth()
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [aguardandoEmail, setAguardandoEmail] = useState(false)

  // Quem já está logado não cria outra conta: vai para a própria tela inicial.
  if (!loading && session) {
    return <Navigate to={profile ? homeFor(profile) : '/sem-acesso'} replace />
  }

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)

    // O required do navegador aceita um nome só com espaços.
    if (!nome.trim()) {
      setErro('Informe seu nome.')
      return
    }
    // Sem minLength no input: assim aparece esta mensagem, e não o balão do navegador.
    if (senha.length < SENHA_MINIMA) {
      setErro(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`)
      return
    }
    if (senha !== confirmacao) {
      setErro('As senhas não são iguais.')
      return
    }

    setEnviando(true)
    // nome e tipo_cadastro: nomes combinados com o trigger que cria o perfil. Não mude.
    // O papel de verdade é gravado pelo banco em profiles.role, nunca lido daqui pelo front.
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome: nome.trim(), tipo_cadastro: 'gestor' } },
    })
    setEnviando(false)

    // Qualquer recusa cai aqui: e-mail repetido, senha fraca e também o trigger recusando o
    // cadastro (ex.: tipo_cadastro inválido), que volta como erro do banco.
    if (error) {
      console.error('Erro ao criar a conta', error)
      setErro('Não foi possível criar a conta. Confira os dados e tente de novo.')
      return
    }
    if (data.session) {
      navigate('/quadro', { replace: true })
      return
    }
    // Sem sessão: a confirmação de e-mail está ligada (produção).
    setAguardandoEmail(true)
  }

  return (
    <main className="tela-centralizada">
      <div className="caixa">
        <div className="topo-marca caixa-marca">
          <span className="topo-marca-icone">
            <Building2 size={20} aria-hidden />
          </span>
          Fila do Síndico
        </div>
        <h1>Criar conta de gestor</h1>

        {aguardandoEmail ? (
          <p role="status" className="aviso aviso-sucesso">
            Enviamos um link para seu e-mail. Clique nele para ativar sua conta.
          </p>
        ) : (
          <form
            className="formulario"
            onSubmit={handleSubmit}
            // O navegador barrou o envio (campo vazio, e-mail inválido): tira o aviso antigo,
            // para sobrar só o balão dele.
            onInvalidCapture={() => setErro(null)}
          >
            <label className="campo">
              <span className="campo-rotulo">
                Nome <span className="obrigatorio">*</span>
              </span>
              <input
                required
                autoComplete="name"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </label>
            <label className="campo">
              <span className="campo-rotulo">
                E-mail <span className="obrigatorio">*</span>
              </span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="campo">
              <span className="campo-rotulo">
                Senha <span className="obrigatorio">*</span>
              </span>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </label>
            <label className="campo">
              <span className="campo-rotulo">
                Confirmar senha <span className="obrigatorio">*</span>
              </span>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
              />
            </label>
            {erro && (
              <p role="alert" className="aviso aviso-erro">
                {erro}
              </p>
            )}
            <button
              type="submit"
              className="botao botao-principal botao-largo"
              disabled={enviando}
            >
              {enviando ? 'Criando conta…' : 'Criar conta'}
            </button>
          </form>
        )}

        <nav className="caixa-links" aria-label="Outras opções">
          <Link to="/login">{aguardandoEmail ? 'Voltar para o login' : 'Já tenho conta'}</Link>
        </nav>
      </div>
    </main>
  )
}
