import { Send } from 'lucide-react'
import { useCallback, useEffect, useState, type SubmitEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Topo } from './Placeholders'
import './MinhasOcorrencias.css'

// Página do morador: registrar ocorrência (SQUAD1-27) e lista "Minhas ocorrências" (SQUAD1-28).

const LIMITE_DESCRICAO = 800

type StatusOcorrencia = 'novo' | 'em_andamento' | 'concluido'

type Ocorrencia = {
  id: string
  local: string | null
  descricao: string
  status: StatusOcorrencia
  created_at: string
}

const ROTULO_STATUS: Record<StatusOcorrencia, string> = {
  novo: 'Pendente',
  em_andamento: 'Em análise',
  concluido: 'Resolvido',
}

// Mensagens que o próprio banco escreve para o usuário (função registrar_ocorrencia).
const ERROS_DO_BANCO_PARA_O_USUARIO = ['22023', '42501']

function mensagemDeErro(error: { code?: string; message: string }): string {
  if (
    error.code &&
    ERROS_DO_BANCO_PARA_O_USUARIO.includes(error.code) &&
    !error.message.startsWith('permission denied')
  ) {
    return error.message
  }
  return 'Não foi possível enviar a ocorrência. Tente de novo.'
}

const formatoData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

// Tempo relativo, como pede o DESIGN.md: "há 25 min", "ontem".
function quando(dataIso: string): string {
  const data = new Date(dataIso)
  const minutos = Math.floor((Date.now() - data.getTime()) / 60_000)
  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `há ${horas} h`

  const hoje = new Date()
  const ontem = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1)
  if (data.toDateString() === ontem.toDateString()) return 'ontem'
  return formatoData.format(data)
}

// O RLS devolve só as ocorrências que o morador registrou.
function buscarOcorrencias() {
  return supabase
    .from('ocorrencias')
    .select('id, local, descricao, status, created_at')
    .order('created_at', { ascending: false })
    .returns<Ocorrencia[]>()
}

type ListaProps = {
  carregando: boolean
  erro: string | null
  itens: Ocorrencia[]
}

function ListaOcorrencias({ carregando, erro, itens }: ListaProps) {
  if (carregando) return <p className="estado-vazio">Carregando…</p>
  if (erro) {
    return (
      <p role="alert" className="aviso aviso-erro">
        {erro}
      </p>
    )
  }
  if (itens.length === 0) {
    return <p className="estado-vazio">Você ainda não registrou nenhuma ocorrência.</p>
  }

  return (
    <ul>
      {itens.map((o) => (
        <li key={o.id} className={o.status === 'concluido' ? 'cartao cartao-apagado' : 'cartao'}>
          <p className="cartao-meta">
            <span className="ocorrencias-status">{ROTULO_STATUS[o.status]}</span>
            {' · '}
            <time dateTime={o.created_at} title={new Date(o.created_at).toLocaleString('pt-BR')}>
              {quando(o.created_at)}
            </time>
          </p>
          <p className="cartao-titulo">{o.local ?? 'Local não informado'}</p>
          <p className="ocorrencias-descricao">{o.descricao}</p>
        </li>
      ))}
    </ul>
  )
}

export function MinhasOcorrencias() {
  const [itens, setItens] = useState<Ocorrencia[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroLista, setErroLista] = useState<string | null>(null)

  const [local, setLocal] = useState('')
  const [descricao, setDescricao] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)

  const carregar = useCallback(() => {
    buscarOcorrencias().then(({ data, error }) => {
      if (error) {
        console.error('Erro ao carregar as ocorrências', error)
        setErroLista('Não foi possível carregar suas ocorrências.')
      } else {
        setErroLista(null)
        setItens(data)
      }
      setCarregando(false)
    })
  }, [])

  useEffect(carregar, [carregar])

  async function enviar(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErroEnvio(null)
    setSucesso(false)

    if (!descricao.trim()) {
      setErroEnvio('Descreva o problema.')
      return
    }

    setEnviando(true)
    // Condomínio, autor e status são definidos pelo banco a partir do cadastro do morador.
    const { error } = await supabase.rpc('registrar_ocorrencia', {
      p_descricao: descricao,
      p_local: local,
    })
    setEnviando(false)

    if (error) {
      console.error('Erro ao registrar a ocorrência', error)
      setErroEnvio(mensagemDeErro(error))
      return
    }

    setLocal('')
    setDescricao('')
    setSucesso(true)
    carregar()
  }

  return (
    <>
      <Topo />
      <main className="pagina-estreita">
        <h1>Registrar ocorrência</h1>

        <form className="formulario ocorrencias-formulario" onSubmit={enviar} noValidate>
          <label className="campo">
            <span className="campo-rotulo">
              Onde fica o problema? <span className="opcional">(opcional)</span>
            </span>
            <input
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Ex.: garagem, 3º andar, bloco B"
            />
          </label>

          <label className="campo">
            <span className="campo-rotulo">
              Descrição <span className="obrigatorio">*</span>
            </span>
            <textarea
              required
              maxLength={LIMITE_DESCRICAO}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva o que aconteceu"
              aria-describedby="descricao-contador"
            />
            <span id="descricao-contador" className="ocorrencias-contador">
              {descricao.length}/{LIMITE_DESCRICAO}
            </span>
          </label>

          {erroEnvio && (
            <p role="alert" className="aviso aviso-erro">
              {erroEnvio}
            </p>
          )}
          {sucesso && (
            <p role="status" className="aviso aviso-sucesso">
              Ocorrência enviada. Você pode acompanhar o andamento na lista abaixo.
            </p>
          )}

          <button type="submit" className="botao botao-principal botao-largo" disabled={enviando}>
            <Send size={16} aria-hidden /> {enviando ? 'Enviando…' : 'Enviar ocorrência'}
          </button>
        </form>

        <section className="ocorrencias-lista" aria-labelledby="titulo-lista">
          <h2 id="titulo-lista">Minhas ocorrências</h2>

          <ListaOcorrencias carregando={carregando} erro={erroLista} itens={itens} />
        </section>
      </main>
    </>
  )
}
