import { useState, type SubmitEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { criarConta, validarSenha } from '../auth/cadastro'
import { useRedirecionarLogado } from '../auth/useRedirecionarLogado'
import { CamposDeAcesso } from '../components/CamposDeAcesso'
import { MarcaCaixa } from '../components/MarcaCaixa'

export function CadastroGestor() {
  const destinoLogado = useRedirecionarLogado()
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [aguardandoEmail, setAguardandoEmail] = useState(false)

  // Quem já está logado não cria outra conta: vai para a própria tela inicial.
  if (destinoLogado) {
    return <Navigate to={destinoLogado} replace />
  }

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)

    // O required do navegador aceita um nome só com espaços.
    if (!nome.trim()) {
      setErro('Informe seu nome.')
      return
    }
    const erroSenha = validarSenha(senha, confirmacao)
    if (erroSenha) {
      setErro(erroSenha)
      return
    }

    setEnviando(true)
    // nome e tipo_cadastro: nomes combinados com o trigger que cria o perfil. Não mude.
    // O papel de verdade é gravado pelo banco em profiles.role, nunca lido daqui pelo front.
    const resultado = await criarConta(email, senha, {
      nome: nome.trim(),
      tipo_cadastro: 'gestor',
    })
    setEnviando(false)

    if (resultado.erro) {
      setErro(resultado.erro)
      return
    }
    if (resultado.comSessao) {
      navigate('/quadro', { replace: true })
      return
    }
    setAguardandoEmail(true)
  }

  return (
    <main className="tela-centralizada">
      <div className="caixa">
        <MarcaCaixa />
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
            <CamposDeAcesso
              email={email}
              senha={senha}
              confirmacao={confirmacao}
              onEmail={setEmail}
              onSenha={setSenha}
              onConfirmacao={setConfirmacao}
            />
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
