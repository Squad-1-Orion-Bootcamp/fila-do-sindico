import { Sparkles, UserCheck } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'

// Prioridade no card do painel do gestor (SQUAD1-64): etiqueta, motivo e seletor.
// Decisões da Riane (docs/decisoes/2026-11-25-squad1-64-prioridade-no-card.md): o painel atualiza ao recarregar; depois que o gestor
// define a prioridade, o motivo dele aparece no lugar do da IA; o seletor salva ao escolher e o
// motivo é opcional; a concluída que a IA não classificou fica sem etiqueta.

export type Urgencia = 'urgente' | 'alta' | 'normal' | 'baixa'

const URGENCIAS: Urgencia[] = ['urgente', 'alta', 'normal', 'baixa']

const ROTULO_URGENCIA: Record<Urgencia, string> = {
  urgente: 'Urgente',
  alta: 'Alta',
  normal: 'Normal',
  baixa: 'Baixa',
}

// Última decisão do gestor sobre a prioridade (tabela decisoes, acao 'definir_prioridade').
export type DecisaoPrioridade = { autorId: string; justificativa: string | null }

// Até 800 caracteres, como na função definir_prioridade_ocorrencia.
const LIMITE_MOTIVO = 800

type Props = {
  ocorrenciaId: string
  concluida: boolean
  urgencia: Urgencia | null
  motivoIA: string | null
  decisao: DecisaoPrioridade | undefined
  meuId: string | undefined
  // Devolve a mensagem de erro, ou null se deu certo.
  aoDefinir: (urgencia: Urgencia, justificativa: string | null) => Promise<string | null>
}

export function EtiquetaPrioridade({ urgencia }: { urgencia: Urgencia | null }) {
  if (!urgencia) return <span className="etiqueta etiqueta-triagem">Aguardando triagem</span>
  return <span className={`etiqueta etiqueta-${urgencia}`}>{ROTULO_URGENCIA[urgencia]}</span>
}

// Frase do motivo, logo abaixo do rodapé do card. Aparece em até 2 linhas; o "Ver tudo" só
// aparece quando a frase foi cortada de fato (mede o texto, porque a largura da coluna muda
// entre celular, tablet e computador).
export function MotivoPrioridade({
  ocorrenciaId,
  urgencia,
  motivoIA,
  decisao,
  meuId,
}: Pick<Props, 'ocorrenciaId' | 'urgencia' | 'motivoIA' | 'decisao' | 'meuId'>) {
  const [aberto, setAberto] = useState(false)
  const [cortado, setCortado] = useState(false)
  const textoRef = useRef<HTMLSpanElement>(null)

  let icone = null
  let texto: string | null = null
  if (decisao) {
    const quem = decisao.autorId === meuId ? 'Definida por você' : 'Definida pelo gestor'
    icone = <UserCheck size={14} aria-hidden />
    texto = decisao.justificativa ? `${quem}: ${decisao.justificativa}` : quem
  } else if (urgencia && motivoIA) {
    icone = <Sparkles size={14} aria-hidden />
    texto = motivoIA
  }

  // Mede de novo quando o texto muda, ao fechar e quando o card muda de largura. Aberto, não
  // mede: o botão "Ver menos" continua na tela (e com o foco) até ser clicado.
  useLayoutEffect(() => {
    const el = textoRef.current
    if (!el || aberto) return
    const medir = () => setCortado(el.scrollHeight > el.clientHeight + 1)
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    return () => observador.disconnect()
  }, [texto, aberto])

  if (!texto) return null

  const id = `motivo-${ocorrenciaId}`
  return (
    <>
      <p
        className={
          aberto ? 'cartao-meta quadro-motivo quadro-motivo-aberto' : 'cartao-meta quadro-motivo'
        }
      >
        {icone}
        <span id={id} ref={textoRef}>
          {texto}
        </span>
      </p>
      {(aberto || cortado) && (
        <button
          type="button"
          className="quadro-acao-texto quadro-motivo-ver"
          aria-expanded={aberto}
          aria-controls={id}
          onClick={() => setAberto((a) => !a)}
        >
          {aberto ? 'Ver menos' : 'Ver tudo'}
        </button>
      )}
    </>
  )
}

// Seletor, "Confirmar" (só quando a prioridade veio da IA) e "Adicionar motivo".
// Não aparece na ocorrência concluída: o banco não deixa mudar a prioridade dela.
export function SeletorPrioridade({
  ocorrenciaId,
  concluida,
  urgencia,
  decisao,
  aoDefinir,
}: Pick<Props, 'ocorrenciaId' | 'concluida' | 'urgencia' | 'decisao' | 'aoDefinir'>) {
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [escrevendo, setEscrevendo] = useState(false)
  const [motivo, setMotivo] = useState('')

  if (concluida) return null

  async function definir(nova: Urgencia, justificativa: string | null) {
    setErro(null)
    setSalvando(true)
    const mensagem = await aoDefinir(nova, justificativa)
    setSalvando(false)
    if (mensagem) {
      setErro(mensagem)
      return false
    }
    return true
  }

  async function salvarMotivo(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!urgencia) return
    if (await definir(urgencia, motivo.trim() || null)) {
      setEscrevendo(false)
      setMotivo('')
    }
  }

  return (
    <div className="quadro-prioridade">
      <label className="quadro-status">
        <span className="cartao-meta">Prioridade</span>
        <select
          value={urgencia ?? ''}
          aria-describedby={`descricao-${ocorrenciaId}`}
          disabled={salvando}
          onChange={(e) => definir(e.target.value as Urgencia, null)}
        >
          {!urgencia && (
            <option value="" disabled>
              Escolher
            </option>
          )}
          {URGENCIAS.map((u) => (
            <option key={u} value={u}>
              {ROTULO_URGENCIA[u]}
            </option>
          ))}
        </select>
      </label>

      {urgencia && !escrevendo && (
        <p className="quadro-acoes-texto">
          {!decisao && (
            <button
              type="button"
              className="quadro-acao-texto"
              disabled={salvando}
              aria-describedby={`descricao-${ocorrenciaId}`}
              onClick={() => definir(urgencia, null)}
            >
              Confirmar {ROTULO_URGENCIA[urgencia].toLowerCase()}
            </button>
          )}
          <button
            type="button"
            className="quadro-acao-texto"
            disabled={salvando}
            aria-describedby={`descricao-${ocorrenciaId}`}
            onClick={() => setEscrevendo(true)}
          >
            Adicionar motivo
          </button>
        </p>
      )}

      {urgencia && escrevendo && (
        <form className="quadro-motivo-form" onSubmit={salvarMotivo}>
          <label className="campo">
            <span className="campo-rotulo">
              Motivo da prioridade {ROTULO_URGENCIA[urgencia].toLowerCase()}{' '}
              <span className="opcional">(opcional)</span>
            </span>
            <textarea
              rows={2}
              maxLength={LIMITE_MOTIVO}
              value={motivo}
              autoFocus
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>
          <div className="quadro-motivo-acoes">
            <button
              type="button"
              className="botao"
              disabled={salvando}
              onClick={() => {
                setEscrevendo(false)
                setMotivo('')
              }}
            >
              Cancelar
            </button>
            <button type="submit" className="botao" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      )}

      {erro && (
        <p role="alert" className="campo-erro">
          {erro}
        </p>
      )}
    </div>
  )
}
