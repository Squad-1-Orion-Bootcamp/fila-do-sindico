import { CircleCheck, CircleX, Clock, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { dataCompleta, tempoRelativo } from '../lib/tempo'
import './CadastrosPendentes.css'

type SolicitacaoVinculo = {
  id: string
  bloco_solicitado: string
  unidade_solicitada: string | null
  created_at: string
  solicitante: { nome: string | null } | null
  condominio: { nome: string } | null
}

const ERROS_DE_REGRA = new Set(['22023', '42501', 'P0002'])

function tratarMensagemErro(error: { code?: string; message: string }, padrao: string): string {
  if (error.code && ERROS_DE_REGRA.has(error.code) && !error.message.startsWith('permission denied')) {
    return error.message
  }
  return padrao
}

// O RLS (solicitacoes_vinculo_ler_proprio_gestor_ou_admin) já devolve apenas as solicitações
// dos condomínios em que o gestor possui vínculo ativo.
function buscarSolicitacoes() {
  return supabase
    .from('solicitacoes_vinculo')
    .select(
      'id, bloco_solicitado, unidade_solicitada, created_at, solicitante:profiles!solicitante_id(nome), condominio:condominios(nome)',
    )
    .eq('status', 'pendente')
    .order('created_at', { ascending: true })
}

export function CadastrosPendentes() {
  const [itens, setItens] = useState<SolicitacaoVinculo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroLista, setErroLista] = useState<string | null>(null)

  const [processandoId, setProcessandoId] = useState<string | null>(null)
  const [acaoTipo, setAcaoTipo] = useState<'aprovar' | 'recusar' | null>(null)
  const [recusandoId, setRecusandoId] = useState<string | null>(null)
  const [motivoRecusa, setMotivoRecusa] = useState('')
  const [erroAcao, setErroAcao] = useState<{ id: string; mensagem: string } | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  function carregarSolicitacoes() {
    return buscarSolicitacoes().then(({ data, error }) => {
      if (error) {
        console.error('Erro ao carregar solicitações de vínculo', error)
        setErroLista('Não foi possível carregar os cadastros pendentes.')
      } else {
        setErroLista(null)
        setItens((data as unknown as SolicitacaoVinculo[]) ?? [])
      }
      setCarregando(false)
    })
  }

  useEffect(() => {
    carregarSolicitacoes()
  }, [])

  async function aprovarSolicitacao(solicitacao: SolicitacaoVinculo) {
    const nomeMorador = solicitacao.solicitante?.nome ?? 'Morador'
    setErroAcao(null)
    setFeedback(null)
    setProcessandoId(solicitacao.id)
    setAcaoTipo('aprovar')

    const { error } = await supabase.rpc('aprovar_solicitacao_vinculo', {
      p_solicitacao_id: solicitacao.id,
    })

    if (error) {
      console.error('Erro ao aprovar solicitação de vínculo', error)
      setErroAcao({
        id: solicitacao.id,
        mensagem: tratarMensagemErro(error, 'Não foi possível aprovar a solicitação. Tente de novo.'),
      })
    } else {
      setItens((atuais) => atuais.filter((s) => s.id !== solicitacao.id))
      setFeedback(`Cadastro de ${nomeMorador} aprovado com sucesso.`)
      if (recusandoId === solicitacao.id) {
        setRecusandoId(null)
        setMotivoRecusa('')
      }
    }

    setProcessandoId(null)
    setAcaoTipo(null)
  }

  function iniciarRecusa(solicitacaoId: string) {
    setErroAcao(null)
    setRecusandoId(solicitacaoId)
    setMotivoRecusa('')
  }

  function cancelarRecusa() {
    setRecusandoId(null)
    setMotivoRecusa('')
    setErroAcao(null)
  }

  async function confirmarRecusa(solicitacao: SolicitacaoVinculo) {
    const motivoLimpo = motivoRecusa.trim()
    if (!motivoLimpo) {
      setErroAcao({
        id: solicitacao.id,
        mensagem: 'Informe o motivo da recusa.',
      })
      return
    }

    const nomeMorador = solicitacao.solicitante?.nome ?? 'Morador'
    setErroAcao(null)
    setFeedback(null)
    setProcessandoId(solicitacao.id)
    setAcaoTipo('recusar')

    const { error } = await supabase.rpc('recusar_solicitacao_vinculo', {
      p_solicitacao_id: solicitacao.id,
      p_motivo: motivoLimpo,
    })

    if (error) {
      console.error('Erro ao recusar solicitação de vínculo', error)
      setErroAcao({
        id: solicitacao.id,
        mensagem: tratarMensagemErro(error, 'Não foi possível recusar a solicitação. Tente de novo.'),
      })
    } else {
      setItens((atuais) => atuais.filter((s) => s.id !== solicitacao.id))
      setFeedback(`Cadastro de ${nomeMorador} recusado.`)
      setRecusandoId(null)
      setMotivoRecusa('')
    }

    setProcessandoId(null)
    setAcaoTipo(null)
  }

  function formatarLocal(bloco: string, unidade: string | null) {
    // A unidade é texto livre do cadastro. "Unidade" só entra quando o morador digitou só o
    // número (ex.: "302", "12A"); "Apto 77" ou "Casa 21" aparecem como ele escreveu.
    const texto = unidade?.trim() ?? ''
    const u = /^\d+[a-z]?$/i.test(texto) ? `Unidade ${texto}` : texto
    const b = bloco ? `Bloco ${bloco}` : ''
    if (b && u) return `${b} · ${u}`
    return b || u || 'Unidade não informada'
  }

  return (
    <section className="cadastros-pendentes" aria-labelledby="titulo-cadastros">
      <div className="cadastros-cabecalho">
        <h2 id="titulo-cadastros">Cadastros aguardando aprovação</h2>
        {!carregando && !erroLista && itens.length > 0 && (
          <span className="contador" aria-label={`${itens.length} cadastros pendentes`}>
            {itens.length}
          </span>
        )}
      </div>

      {feedback && (
        <p role="status" className="aviso aviso-sucesso cadastros-aviso">
          {feedback}
        </p>
      )}

      {carregando && <p className="estado-vazio">Carregando…</p>}

      {!carregando && erroLista && (
        <p role="alert" className="aviso aviso-erro">
          {erroLista}
        </p>
      )}

      {!carregando && !erroLista && itens.length === 0 && (
        <p className="estado-vazio">Nenhum cadastro aguardando aprovação</p>
      )}

      {!carregando && !erroLista && itens.length > 0 && (
        <ul className="cadastros-lista">
          {itens.map((s) => {
            const estaProcessando = processandoId === s.id
            const emRecusa = recusandoId === s.id
            const nomeMorador = s.solicitante?.nome ?? 'Morador'
            const nomeCondominio = s.condominio?.nome ?? 'Condomínio'
            const localFormatado = formatarLocal(s.bloco_solicitado, s.unidade_solicitada)

            return (
              <li key={s.id} className="cartao cadastro-item">
                <div className="cadastro-topo">
                  <span className="topo-marca-icone">
                    <User size={20} aria-hidden />
                  </span>
                  <div className="cadastro-dados">
                    <p className="cartao-titulo">{nomeMorador}</p>
                    <p className="cartao-meta">
                      {nomeCondominio} · {localFormatado}
                    </p>
                    <p className="cadastro-data">
                      <Clock size={12} aria-hidden />
                      <time dateTime={s.created_at} title={dataCompleta(s.created_at)}>
                        Solicitado {tempoRelativo(s.created_at)}
                      </time>
                    </p>
                  </div>
                </div>

                {erroAcao?.id === s.id && (
                  <p role="alert" className="campo-erro">
                    {erroAcao.mensagem}
                  </p>
                )}

                {emRecusa ? (
                  <div className="cadastro-recusa">
                    <label className="campo">
                      <span className="campo-rotulo">
                        Motivo da recusa <span className="obrigatorio">*</span>
                      </span>
                      <textarea
                        required
                        disabled={estaProcessando}
                        placeholder="Explique o motivo. O morador visualizará esta mensagem."
                        value={motivoRecusa}
                        onChange={(e) => setMotivoRecusa(e.target.value)}
                      />
                    </label>
                    <div className="cadastro-recusa-acoes">
                      <button
                        type="button"
                        className="botao"
                        disabled={estaProcessando}
                        onClick={cancelarRecusa}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="botao botao-principal"
                        disabled={estaProcessando}
                        onClick={() => confirmarRecusa(s)}
                      >
                        {estaProcessando && acaoTipo === 'recusar' ? 'Recusando…' : 'Confirmar recusa'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="cadastro-acoes">
                    <button
                      type="button"
                      className="botao"
                      disabled={estaProcessando}
                      onClick={() => iniciarRecusa(s.id)}
                    >
                      <CircleX size={16} aria-hidden /> Recusar
                    </button>
                    <button
                      type="button"
                      className="botao"
                      disabled={estaProcessando}
                      onClick={() => aprovarSolicitacao(s)}
                    >
                      <CircleCheck size={16} aria-hidden />
                      {estaProcessando && acaoTipo === 'aprovar' ? 'Aprovando…' : 'Aprovar'}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
