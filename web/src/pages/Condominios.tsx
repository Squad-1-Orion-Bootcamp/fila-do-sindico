import { Building2 } from 'lucide-react'
import { useEffect, useState, type SubmitEvent } from 'react'
import { CNPJ_DIGITOS, formatarCnpj, somenteDigitos } from '../lib/cnpj'
import { supabase } from '../lib/supabase'
import { Topo } from './Placeholders'
import './Condominios.css'

type Condominio = { id: string; nome: string; cnpj: string | null }

// Erros de regra levantados por cadastrar_condominio, com texto em português feito para o
// usuário (CNPJ repetido, CNPJ incompleto, nome vazio, conta sem papel de gestor).
// Qualquer outro erro (rede, permissão inesperada) mostra a mensagem genérica.
const ERROS_DE_REGRA = new Set(['22023', '23505', '42501'])

// Sem filtro por usuário: o RLS (condominios_ler_vinculados) já devolve só os condomínios
// em que o gestor tem vínculo ativo.
function buscarCondominios() {
  return supabase.from('condominios').select('id, nome, cnpj').order('nome')
}

export function Condominios() {
  const [itens, setItens] = useState<Condominio[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroLista, setErroLista] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  // Usada na abertura da tela e depois de cada cadastro. O estado só muda quando a resposta
  // chega, então o "Carregando…" aparece só na primeira vez.
  function carregarLista() {
    return buscarCondominios().then(({ data, error }) => {
      if (error) {
        console.error('Erro ao carregar os condomínios', error)
        setErroLista('Não foi possível carregar os condomínios.')
      } else {
        setErroLista(null)
        setItens(data)
      }
      setCarregando(false)
    })
  }

  useEffect(() => {
    carregarLista()
  }, [])

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    setSucesso(null)

    // O required do navegador aceita um nome só com espaços.
    if (!nome.trim()) {
      setErro('Informe o nome do condomínio.')
      return
    }
    const digitos = somenteDigitos(cnpj)
    if (digitos.length !== CNPJ_DIGITOS) {
      setErro('Informe um CNPJ com 14 dígitos.')
      return
    }

    setEnviando(true)
    const { error } = await supabase.rpc('cadastrar_condominio', {
      p_nome: nome.trim(),
      p_cnpj: digitos,
    })

    if (error) {
      console.error('Erro ao cadastrar o condomínio', error)
      setErro(
        ERROS_DE_REGRA.has(error.code)
          ? error.message
          : 'Não foi possível cadastrar o condomínio. Tente de novo.',
      )
      setEnviando(false)
      return
    }

    setNome('')
    setCnpj('')
    setSucesso('Condomínio cadastrado.')
    await carregarLista()
    setEnviando(false)
  }

  return (
    <>
      <Topo />
      <main className="pagina-estreita condominios">
        <div>
          <h1>Meus condomínios</h1>
          <p className="subtitulo">Cadastre os condomínios que você administra</p>
        </div>

        <section className="cartao" aria-labelledby="titulo-cadastro">
          <h2 id="titulo-cadastro" className="condominios-titulo-bloco">
            Cadastrar condomínio
          </h2>
          <form
            className="formulario"
            onSubmit={handleSubmit}
            // O navegador barrou o envio (campo vazio): tira o aviso antigo.
            onInvalidCapture={() => {
              setErro(null)
              setSucesso(null)
            }}
          >
            <label className="campo">
              <span className="campo-rotulo">
                Nome do condomínio <span className="obrigatorio">*</span>
              </span>
              <input
                required
                autoComplete="off"
                placeholder="Ex.: Residencial Aurora"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </label>
            <label className="campo">
              <span className="campo-rotulo">
                CNPJ <span className="obrigatorio">*</span>
              </span>
              <input
                required
                inputMode="numeric"
                autoComplete="off"
                placeholder="00.000.000/0000-00"
                value={cnpj}
                onChange={(e) => setCnpj(formatarCnpj(e.target.value))}
              />
            </label>
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
            <button
              type="submit"
              className="botao botao-principal botao-largo"
              disabled={enviando}
            >
              {enviando ? 'Cadastrando…' : 'Cadastrar condomínio'}
            </button>
          </form>
        </section>

        <section aria-labelledby="titulo-lista">
          <h2 id="titulo-lista" className="condominios-titulo-bloco">
            Seus condomínios
          </h2>
          {carregando && <p className="estado-vazio">Carregando…</p>}
          {!carregando && erroLista && (
            <p role="alert" className="aviso aviso-erro">
              {erroLista}
            </p>
          )}
          {!carregando && !erroLista && itens.length === 0 && (
            <p className="estado-vazio">Cadastre seu primeiro condomínio.</p>
          )}
          {!carregando && !erroLista && itens.length > 0 && (
            // Cada item vira link para o condomínio quando entrar a gestão de moradores.
            <ul className="condominios-lista">
              {itens.map((c) => (
                <li key={c.id} className="cartao condominios-item">
                  <span className="topo-marca-icone">
                    <Building2 size={16} aria-hidden />
                  </span>
                  <div>
                    <p className="cartao-titulo">{c.nome}</p>
                    <p className="cartao-meta">
                      CNPJ {c.cnpj ? formatarCnpj(c.cnpj) : 'não informado'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  )
}
