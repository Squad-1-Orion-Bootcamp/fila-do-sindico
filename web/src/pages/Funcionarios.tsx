import { UserPlus } from 'lucide-react'
import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import { Link } from 'react-router-dom'
import { deWhatsApp, formatarCelular, paraWhatsApp } from '../lib/celular'
import { supabase } from '../lib/supabase'
import { Topo } from './Placeholders'
import './Funcionarios.css'

// Aba Funcionários (SQUAD1-70). Funcionário é um contato sem login, cadastrado pelo gestor e
// usado na delegação (US 3). Tabela e funções da SQUAD1-69: leitura só do gestor do
// condomínio (RLS), escrita só por cadastrar_funcionario e desativar_funcionario.

type Condominio = { id: string; nome: string }

type Funcionario = {
  id: string
  nome: string
  celular: string
  funcao: string
  ativo: boolean
  condominio_id: string
  condominios: { nome: string } | null
}

// Erros de regra das funções do banco, com texto em português feito para o usuário (celular
// repetido entre os ativos, campo inválido, quem não é gestor do condomínio). Qualquer outro
// erro (rede, permissão inesperada) mostra a mensagem genérica.
const ERROS_DE_REGRA = new Set(['22023', '23505', '42501'])

const FUNCOES = ['Zelador', 'Porteiro', 'Auxiliar de limpeza'] as const
const OUTRA = 'Outra'
const LIMITE_FUNCAO = 60
const TODOS = 'todos'

// Ativos primeiro, depois por nome.
function ordenar(lista: Funcionario[]) {
  return [...lista].sort(
    (a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, 'pt-BR'),
  )
}

// Sem filtro por usuário: o RLS devolve só os funcionários e os condomínios do gestor.
function buscarFuncionarios() {
  return supabase
    .from('funcionarios')
    .select('id, nome, celular, funcao, ativo, condominio_id, condominios(nome)')
    .returns<Funcionario[]>()
}

function buscarCondominios() {
  return supabase.from('condominios').select('id, nome').order('nome').returns<Condominio[]>()
}

// O 42501 também vem do próprio Postgres ("permission denied for ..."), em inglês: esse não
// vai para a tela.
function mensagemDoBanco(error: { code: string; message: string }, generica: string) {
  return ERROS_DE_REGRA.has(error.code) && !error.message.startsWith('permission denied')
    ? error.message
    : generica
}

export function Funcionarios() {
  const [itens, setItens] = useState<Funcionario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroLista, setErroLista] = useState<string | null>(null)

  const [condominios, setCondominios] = useState<Condominio[]>([])
  const [carregandoCondominios, setCarregandoCondominios] = useState(true)
  const [erroCondominios, setErroCondominios] = useState<string | null>(null)
  const [filtro, setFiltro] = useState(TODOS)

  const [nome, setNome] = useState('')
  const [celular, setCelular] = useState('')
  const [condominioId, setCondominioId] = useState('')
  const [funcao, setFuncao] = useState('')
  const [outraFuncao, setOutraFuncao] = useState('')
  const [erroCelular, setErroCelular] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)
  const [desativandoId, setDesativandoId] = useState<string | null>(null)
  const [erroDesativar, setErroDesativar] = useState<{ id: string; mensagem: string } | null>(
    null,
  )
  // Foco do teclado: ao cancelar, volta para o "Desativar" da linha; depois de desativar (o
  // botão some), vai para o título da lista.
  const botoesDesativar = useRef(new Map<string, HTMLButtonElement>())
  const tituloLista = useRef<HTMLHeadingElement>(null)
  const focoPendente = useRef<string | 'lista' | null>(null)

  // Roda depois de cada renderização: o botão ou o título já está na tela.
  useEffect(() => {
    const alvo = focoPendente.current
    if (alvo === null) return
    focoPendente.current = null
    if (alvo === 'lista') tituloLista.current?.focus()
    else botoesDesativar.current.get(alvo)?.focus()
  })

  // Usada na abertura da tela e depois de cada cadastro ou desativação. O "Carregando…" só
  // aparece na primeira vez.
  function carregarLista() {
    return buscarFuncionarios().then(({ data, error }) => {
      if (error) {
        console.error('Erro ao carregar os funcionários', error)
        setErroLista('Não foi possível carregar os funcionários.')
      } else {
        setErroLista(null)
        setItens(ordenar(data))
      }
      setCarregando(false)
    })
  }

  useEffect(() => {
    carregarLista()
    buscarCondominios().then(({ data, error }) => {
      if (error) {
        console.error('Erro ao carregar os condomínios', error)
        setErroCondominios('Não foi possível carregar os seus condomínios.')
      } else {
        setCondominios(data)
        // Com um condomínio só, ele já vem escolhido.
        if (data.length === 1) setCondominioId(data[0].id)
      }
      setCarregandoCondominios(false)
    })
  }, [])

  function limparAvisos() {
    setErro(null)
    setSucesso(null)
    setErroCelular(null)
  }

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    limparAvisos()

    // O required do navegador aceita um texto só com espaços.
    if (!nome.trim()) {
      setErro('Informe o nome do funcionário.')
      return
    }
    const celularNoBanco = paraWhatsApp(celular)
    if (!celularNoBanco) {
      setErroCelular('Informe o celular com DDD e 9 dígitos.')
      return
    }
    if (!condominioId) {
      setErro('Escolha o condomínio do funcionário.')
      return
    }
    const funcaoFinal = funcao === OUTRA ? outraFuncao.trim() : funcao
    if (!funcaoFinal) {
      setErro(funcao === OUTRA ? 'Informe a função.' : 'Escolha a função do funcionário.')
      return
    }

    setEnviando(true)
    const { error } = await supabase.rpc('cadastrar_funcionario', {
      p_condominio_id: condominioId,
      p_nome: nome.trim(),
      p_celular: celularNoBanco,
      p_funcao: funcaoFinal,
    })

    if (error) {
      console.error('Erro ao cadastrar o funcionário', error)
      setErro(mensagemDoBanco(error, 'Não foi possível cadastrar o funcionário. Tente de novo.'))
      setEnviando(false)
      return
    }

    // Mantém o condomínio escolhido, para cadastrar vários no mesmo prédio.
    setNome('')
    setCelular('')
    setFuncao('')
    setOutraFuncao('')
    setSucesso('Funcionário cadastrado.')
    await carregarLista()
    setEnviando(false)
  }

  async function desativar(f: Funcionario) {
    setErroDesativar(null)
    setDesativandoId(f.id)
    const { error } = await supabase.rpc('desativar_funcionario', { p_funcionario_id: f.id })
    if (error) {
      console.error('Erro ao desativar o funcionário', error)
      setErroDesativar({
        id: f.id,
        mensagem: mensagemDoBanco(error, 'Não foi possível desativar. Tente de novo.'),
      })
    } else {
      setConfirmandoId(null)
      await carregarLista()
      focoPendente.current = 'lista'
    }
    setDesativandoId(null)
  }

  const visiveis = filtro === TODOS ? itens : itens.filter((f) => f.condominio_id === filtro)

  function formulario() {
    if (carregandoCondominios) return <p className="estado-vazio">Carregando…</p>
    if (erroCondominios) {
      return (
        <p role="alert" className="aviso aviso-erro">
          {erroCondominios}
        </p>
      )
    }
    if (condominios.length === 0) {
      return (
        <p className="aviso funcionarios-sem-condominio">
          Cadastre um condomínio antes de cadastrar funcionários.{' '}
          <Link to="/condominios">Ir para Condomínios</Link>
        </p>
      )
    }
    return (
      <form
        className="formulario"
        onSubmit={handleSubmit}
        // As validações são feitas no envio, para o erro do celular aparecer no próprio campo.
        noValidate
      >
        <label className="campo">
          <span className="campo-rotulo">
            Nome <span className="obrigatorio">*</span>
          </span>
          <input
            required
            autoComplete="off"
            maxLength={120}
            placeholder="Ex.: João da Silva"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </label>

        <label className="campo">
          <span className="campo-rotulo">
            Celular (WhatsApp) <span className="obrigatorio">*</span>
          </span>
          <input
            required
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="(11) 99999-8888"
            value={celular}
            aria-invalid={erroCelular ? true : undefined}
            aria-describedby={erroCelular ? 'erro-celular' : undefined}
            onChange={(e) => {
              setCelular(formatarCelular(e.target.value))
              setErroCelular(null)
            }}
          />
          {erroCelular && (
            <span id="erro-celular" role="alert" className="campo-erro">
              {erroCelular}
            </span>
          )}
        </label>

        <div className="linha-campos">
          <label className="campo">
            <span className="campo-rotulo">
              Condomínio <span className="obrigatorio">*</span>
            </span>
            <select
              required
              value={condominioId}
              onChange={(e) => setCondominioId(e.target.value)}
            >
              <option value="" disabled>
                Escolha…
              </option>
              {condominios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="campo">
            <span className="campo-rotulo">
              Função <span className="obrigatorio">*</span>
            </span>
            <select required value={funcao} onChange={(e) => setFuncao(e.target.value)}>
              <option value="" disabled>
                Escolha…
              </option>
              {FUNCOES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
              <option value={OUTRA}>{OUTRA}</option>
            </select>
          </label>
        </div>

        {funcao === OUTRA && (
          <label className="campo">
            <span className="campo-rotulo">
              Qual função? <span className="obrigatorio">*</span>
            </span>
            <input
              required
              autoComplete="off"
              maxLength={LIMITE_FUNCAO}
              placeholder="Ex.: Jardineiro"
              value={outraFuncao}
              onChange={(e) => setOutraFuncao(e.target.value)}
            />
          </label>
        )}

        {erro && (
          <p role="alert" className="aviso aviso-erro">
            {erro}
          </p>
        )}
        {sucesso && (
          <p role="status" className="aviso aviso-sucesso">
            {sucesso}
          </p>
        )}
        <button type="submit" className="botao botao-principal botao-largo" disabled={enviando}>
          <UserPlus size={16} aria-hidden /> {enviando ? 'Cadastrando…' : 'Cadastrar funcionário'}
        </button>
      </form>
    )
  }

  function acoes(f: Funcionario) {
    if (!f.ativo) return null
    if (confirmandoId !== f.id) {
      return (
        <button
          type="button"
          className="botao"
          ref={(botao) => {
            if (botao) botoesDesativar.current.set(f.id, botao)
            else botoesDesativar.current.delete(f.id)
          }}
          onClick={() => {
            setErroDesativar(null)
            setConfirmandoId(f.id)
          }}
        >
          Desativar
        </button>
      )
    }
    return (
      <div className="funcionarios-confirmar" role="group" aria-label={`Desativar ${f.nome}`}>
        <p className="cartao-meta">
          Desativar {f.nome}? Ele não aparece mais na delegação.
        </p>
        <div className="funcionarios-confirmar-botoes">
          <button
            type="button"
            className="botao botao-principal"
            disabled={desativandoId === f.id}
            onClick={() => desativar(f)}
          >
            {desativandoId === f.id ? 'Desativando…' : 'Confirmar'}
          </button>
          <button
            type="button"
            className="botao"
            // Abre a confirmação com o foco no Cancelar, a opção que não muda nada.
            autoFocus
            disabled={desativandoId === f.id}
            onClick={() => {
              setErroDesativar(null)
              setConfirmandoId(null)
              focoPendente.current = f.id
            }}
          >
            Cancelar
          </button>
        </div>
        {erroDesativar?.id === f.id && (
          <p role="alert" className="campo-erro">
            {erroDesativar.mensagem}
          </p>
        )}
      </div>
    )
  }

  function lista() {
    if (carregando) return <p className="estado-vazio">Carregando…</p>
    if (erroLista) {
      return (
        <p role="alert" className="aviso aviso-erro">
          {erroLista}
        </p>
      )
    }
    if (itens.length === 0) {
      return <p className="estado-vazio">Nenhum funcionário cadastrado ainda.</p>
    }
    return (
      <>
        {condominios.length > 1 && (
          <label className="campo funcionarios-filtro">
            <span className="campo-rotulo">Mostrar</span>
            <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
              <option value={TODOS}>Todos os condomínios</option>
              {condominios.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
        )}
        {visiveis.length === 0 ? (
          <p className="estado-vazio">Nenhum funcionário neste condomínio.</p>
        ) : (
          <table className="funcionarios-tabela">
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">Função</th>
                <th scope="col">Celular</th>
                <th scope="col">Condomínio</th>
                <th scope="col">Situação</th>
                <th scope="col">
                  <span className="funcionarios-oculto">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((f) => (
                <tr key={f.id} className={f.ativo ? undefined : 'funcionarios-desativado'}>
                  <th scope="row" data-rotulo="Nome">
                    {f.nome}
                  </th>
                  <td data-rotulo="Função">{f.funcao}</td>
                  <td data-rotulo="Celular">{deWhatsApp(f.celular)}</td>
                  <td data-rotulo="Condomínio">{f.condominios?.nome ?? 'Condomínio'}</td>
                  <td data-rotulo="Situação">{f.ativo ? 'Ativo' : 'Desativado'}</td>
                  <td className="funcionarios-acoes">{acoes(f)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </>
    )
  }

  return (
    <>
      <Topo />
      <main className="pagina funcionarios">
        <div>
          <h1>Funcionários</h1>
          <p className="subtitulo">Quem pode receber as tarefas delegadas pelo WhatsApp</p>
        </div>

        <section className="cartao funcionarios-cadastro" aria-labelledby="titulo-cadastro">
          <h2 id="titulo-cadastro" className="funcionarios-titulo-bloco">
            Cadastrar funcionário
          </h2>
          {formulario()}
        </section>

        <section aria-labelledby="titulo-lista">
          <h2 id="titulo-lista" className="funcionarios-titulo-bloco" ref={tituloLista} tabIndex={-1}>
            Seus funcionários
          </h2>
          {lista()}
        </section>
      </main>
    </>
  )
}
