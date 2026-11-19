import { Building2 } from 'lucide-react'
import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { homeFor } from '../auth/homeFor'
import { listarCondominios, type CondominioPublico } from '../lib/condominios'
import { supabase } from '../lib/supabase'

const SENHA_MINIMA = 6 // igual ao minimum_password_length do Supabase

// Para a busca ignorar maiúsculas e acentos ("sao joao" encontra "São João").
function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

export function CadastroMorador() {
  const { session, profile, loading } = useAuth()
  const navigate = useNavigate()

  const [condominios, setCondominios] = useState<CondominioPublico[]>([])
  const [carregandoLista, setCarregandoLista] = useState(true)
  const [erroLista, setErroLista] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

  const [condominioId, setCondominioId] = useState('')
  const [nome, setNome] = useState('')
  const [unidade, setUnidade] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  useEffect(() => {
    listarCondominios()
      .then(setCondominios)
      .catch((error: unknown) => {
        console.error('Erro ao carregar os condomínios', error)
        setErroLista('Não foi possível carregar os condomínios. Tente de novo mais tarde.')
      })
      .finally(() => setCarregandoLista(false))
  }, [])

  // Quem já está logado não cria outra conta: vai para a própria tela inicial.
  if (!loading && session) {
    return <Navigate to={profile ? homeFor(profile) : '/sem-acesso'} replace />
  }

  const filtrados = condominios.filter((c) => normalizar(c.nome).includes(normalizar(busca)))

  function handleBusca(texto: string) {
    setBusca(texto)
    // Se a busca esconder o condomínio escolhido, desmarca, para não enviar um que não aparece.
    const escolhido = condominios.find((c) => c.id === condominioId)
    if (escolhido && !normalizar(escolhido.nome).includes(normalizar(texto))) {
      setCondominioId('')
    }
  }

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)

    // Validações aqui, e não com required/minLength, para aparecer a nossa mensagem.
    if (!condominioId) {
      setErro('Escolha o seu condomínio.')
      return
    }
    if (!nome.trim()) {
      setErro('Informe seu nome.')
      return
    }
    if (!unidade.trim()) {
      setErro('Informe sua unidade.')
      return
    }
    if (senha.length < SENHA_MINIMA) {
      setErro(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`)
      return
    }
    if (senha !== confirmacao) {
      setErro('As senhas não são iguais.')
      return
    }

    setEnviando(true)
    // Nomes combinados com o trigger que cria o perfil e o vínculo pendente. Não mude.
    // O papel e o vínculo de verdade são gravados pelo banco, nunca lidos daqui pelo front.
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: {
          nome: nome.trim(),
          tipo_cadastro: 'morador',
          condominio_id: condominioId,
          unidade: unidade.trim(),
        },
      },
    })
    setEnviando(false)

    // Qualquer recusa cai aqui: e-mail repetido, senha fraca e também o trigger recusando o
    // cadastro (ex.: condomínio sem gestor aprovado), que volta como erro do banco.
    if (error) {
      console.error('Erro ao criar a conta', error)
      setErro('Não foi possível criar a conta. Confira os dados e tente de novo.')
      return
    }
    if (data.session) {
      // Já logado, mas pendente: a tela de acesso não liberado mostra o aviso de cadastro enviado.
      navigate('/sem-acesso', { replace: true, state: { cadastroEnviado: true } })
      return
    }
    // Sem sessão: a confirmação de e-mail está ligada (produção).
    setEnviado(true)
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
        <h1>Criar conta de morador</h1>

        {enviado ? (
          <p role="status" className="aviso aviso-sucesso">
            Cadastro enviado! O gestor do condomínio vai analisar seu pedido. Confira também seu
            e-mail para ativar a conta.
          </p>
        ) : (
          <form
            className="formulario"
            onSubmit={handleSubmit}
            // O navegador barrou o envio (campo vazio, e-mail inválido): tira o aviso antigo,
            // para sobrar só o balão dele.
            onInvalidCapture={() => setErro(null)}
          >
            <div className="campo">
              <span className="campo-rotulo" id="rotulo-condominio">
                Condomínio <span className="obrigatorio">*</span>
              </span>
              {carregandoLista && <p className="estado-vazio">Carregando condomínios…</p>}
              {erroLista && (
                <p role="alert" className="aviso aviso-erro">
                  {erroLista}
                </p>
              )}
              {!carregandoLista && !erroLista && condominios.length === 0 && (
                <p className="estado-vazio">Nenhum condomínio disponível ainda.</p>
              )}
              {!carregandoLista && !erroLista && condominios.length > 0 && (
                <>
                  <input
                    type="search"
                    aria-label="Buscar condomínio"
                    placeholder="Digite para buscar"
                    value={busca}
                    onChange={(e) => handleBusca(e.target.value)}
                  />
                  <select
                    aria-labelledby="rotulo-condominio"
                    value={condominioId}
                    onChange={(e) => setCondominioId(e.target.value)}
                  >
                    <option value="">
                      {filtrados.length > 0
                        ? 'Selecione o condomínio'
                        : 'Nenhum condomínio encontrado'}
                    </option>
                    {filtrados.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
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
                Unidade <span className="obrigatorio">*</span>
              </span>
              <input
                required
                placeholder="Ex.: Bloco B, apto 302"
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
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
              {enviando ? 'Enviando cadastro…' : 'Enviar cadastro'}
            </button>
          </form>
        )}

        <nav className="caixa-links" aria-label="Outras opções">
          <Link to="/login">{enviado ? 'Voltar para o login' : 'Já tenho conta'}</Link>
        </nav>
      </div>
    </main>
  )
}
