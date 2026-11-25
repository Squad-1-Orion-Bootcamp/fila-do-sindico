import { Clock, MessageSquareText, Repeat, Send, User, UserCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { dataCompleta, tempoRelativo } from '../lib/tempo'
import { DelegarOcorrencia } from './DelegarOcorrencia'
import './OcorrenciasDoGestor.css'

// Bloco do painel do gestor: ocorrências de todos os seus condomínios (SQUAD1-29).

type Status = 'novo' | 'em_andamento' | 'delegado' | 'concluido'
type Urgencia = 'urgente' | 'alta' | 'normal' | 'baixa'

type Ocorrencia = {
  id: string
  condominio_id: string
  local: string | null
  descricao: string
  status: Status
  urgencia_atual: Urgencia | null
  created_at: string
  condominio_nome: string | null
  registrado_por_nome: string | null
}

// Delegação de cada ocorrência (SQUAD1-78): quem é o responsável agora e, depois da
// conclusão pelo link, o comentário do funcionário. Só o gestor lê delegacoes (RLS).
type Delegacao = {
  ocorrencia_id: string
  funcionario_id: string
  situacao: 'ativa' | 'concluida'
  comentario: string | null
  concluida_em: string | null
  funcionarios: { nome: string } | null
}

type InfoDelegacao = {
  ativa?: { funcionarioId: string; nome: string }
  concluida?: { nome: string; comentario: string | null; concluidaEm: string }
}

function buscarDelegacoes() {
  return supabase
    .from('delegacoes')
    .select('ocorrencia_id, funcionario_id, situacao, comentario, concluida_em, funcionarios(nome)')
    .in('situacao', ['ativa', 'concluida'])
    .returns<Delegacao[]>()
}

// Uma ocorrência tem no máximo uma delegação ativa. Se ela foi reaberta e concluída de novo,
// vale a conclusão mais recente.
function porOcorrencia(lista: Delegacao[]): Record<string, InfoDelegacao> {
  const mapa: Record<string, InfoDelegacao> = {}
  for (const d of lista) {
    const info = (mapa[d.ocorrencia_id] ??= {})
    const nome = d.funcionarios?.nome ?? 'Funcionário'
    if (d.situacao === 'ativa') {
      info.ativa = { funcionarioId: d.funcionario_id, nome }
    } else if (d.concluida_em && (!info.concluida || d.concluida_em > info.concluida.concluidaEm)) {
      info.concluida = { nome, comentario: d.comentario, concluidaEm: d.concluida_em }
    }
  }
  return mapa
}

// Nomes das colunas da US 1 (SQUAD1-61), também no seletor do card. O morador continua vendo
// os da SQUAD1-5 (Pendente, Em análise, Resolvido) na página dele.
const ROTULO_STATUS: Record<Status, string> = {
  novo: 'Novo',
  em_andamento: 'Em andamento',
  delegado: 'Delegado',
  concluido: 'Concluído',
}

// Ordem das colunas no quadro.
const COLUNAS: Status[] = ['novo', 'em_andamento', 'delegado', 'concluido']

// Mais urgentes primeiro; a ocorrência que a IA ainda não classificou vem depois das
// classificadas. Empate: a mais antiga primeiro.
const PESO_URGENCIA: Record<Urgencia, number> = { urgente: 0, alta: 1, normal: 2, baixa: 3 }

function ordemNaColuna(a: Ocorrencia, b: Ocorrencia): number {
  const pa = a.urgencia_atual ? PESO_URGENCIA[a.urgencia_atual] : 4
  const pb = b.urgencia_atual ? PESO_URGENCIA[b.urgencia_atual] : 4
  if (pa !== pb) return pa - pb
  return a.created_at.localeCompare(b.created_at)
}

// "Delegado" só vem pela delegação (botão Delegar), nunca pela troca de status.
const STATUS_ESCOLHIVEIS: Status[] = ['novo', 'em_andamento', 'concluido']

const ROTULO_URGENCIA: Record<Urgencia, string> = {
  urgente: 'Urgente',
  alta: 'Alta',
  normal: 'Normal',
  baixa: 'Baixa',
}

// A função do banco devolve só as ocorrências dos condomínios em que o gestor tem vínculo
// ativo, já das mais novas para as mais antigas. A urgência não vem de .from('ocorrencias'):
// essa coluna é fechada para o morador, e permissão por coluna vale para todo usuário logado.
function buscarOcorrencias() {
  return supabase.rpc('listar_ocorrencias_gestor')
}

// Valor do filtro que mostra todos os condomínios (a visão padrão do painel).
const TODOS = 'todos'

// A urgência vem da IA a partir da Sprint 2; até lá a etiqueta mostra "Aguardando triagem".
function EtiquetaPrioridade({ urgencia }: { urgencia: Urgencia | null }) {
  if (!urgencia) return <span className="etiqueta etiqueta-triagem">Aguardando triagem</span>
  return <span className={`etiqueta etiqueta-${urgencia}`}>{ROTULO_URGENCIA[urgencia]}</span>
}

export function OcorrenciasDoGestor() {
  const [itens, setItens] = useState<Ocorrencia[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [erroStatus, setErroStatus] = useState<{ id: string; mensagem: string } | null>(null)
  const [filtroCondominio, setFiltroCondominio] = useState(TODOS)
  const [delegando, setDelegando] = useState<Ocorrencia | null>(null)
  const [delegacoes, setDelegacoes] = useState<Record<string, InfoDelegacao>>({})
  const [erroDelegacoes, setErroDelegacoes] = useState(false)
  // Sobe a cada delegação ou troca de status, para recarregar responsáveis e comentários.
  const [versaoDelegacoes, setVersaoDelegacoes] = useState(0)
  // No celular o quadro mostra uma coluna por vez (DESIGN.md), escolhida nas abas.
  const [colunaAberta, setColunaAberta] = useState<Status>('novo')

  useEffect(() => {
    buscarOcorrencias().then(({ data, error }) => {
      if (error) {
        console.error('Erro ao carregar as ocorrências', error)
        setErro('Não foi possível carregar as ocorrências.')
      } else {
        // Sem tipos gerados, o supabase-js não sabe o formato que a função devolve.
        setItens(data as Ocorrencia[])
      }
      setCarregando(false)
    })
  }, [])

  useEffect(() => {
    buscarDelegacoes().then(({ data, error }) => {
      if (error) {
        console.error('Erro ao carregar as delegações', error)
        setErroDelegacoes(true)
      } else {
        setErroDelegacoes(false)
        setDelegacoes(porOcorrencia(data))
      }
    })
  }, [versaoDelegacoes])

  async function alterarStatus(id: string, status: Status) {
    setErroStatus(null)
    setSalvandoId(id)
    const { error } = await supabase.rpc('alterar_status_ocorrencia', {
      p_ocorrencia_id: id,
      p_status: status,
    })
    if (error) {
      console.error('Erro ao alterar o status', error)
      setErroStatus({ id, mensagem: 'Não foi possível alterar o status. Tente de novo.' })
    } else {
      setItens((atuais) => atuais.map((o) => (o.id === id ? { ...o, status } : o)))
      // Trocar o status revoga o link ativo ("assumir de volta").
      setVersaoDelegacoes((v) => v + 1)
    }
    setSalvandoId(null)
  }

  // Filtro por condomínio (SQUAD1-31): só de interface, sobre o que o banco já devolveu.
  // O padrão é ver todos os condomínios juntos.
  const condominios = [
    ...new Map(itens.map((o) => [o.condominio_id, o.condominio_nome ?? 'Condomínio'])),
  ].sort(([, a], [, b]) => a.localeCompare(b, 'pt-BR'))

  const visiveis =
    filtroCondominio === TODOS ? itens : itens.filter((o) => o.condominio_id === filtroCondominio)

  const totalCondominios = new Set(visiveis.map((o) => o.condominio_id)).size

  const porColuna = Object.fromEntries(
    COLUNAS.map((s) => [s, visiveis.filter((o) => o.status === s).sort(ordemNaColuna)]),
  ) as Record<Status, Ocorrencia[]>

  function cartao(o: Ocorrencia) {
    const concluida = delegacoes[o.id]?.concluida
    return (
      <li key={o.id} className={o.status === 'concluido' ? 'cartao cartao-apagado' : 'cartao'}>
        <EtiquetaPrioridade urgencia={o.urgencia_atual} />
        <p className="cartao-meta quadro-onde">
          {o.condominio_nome ?? 'Condomínio'}
          {o.local && ` · ${o.local}`}
        </p>
        <p id={`descricao-${o.id}`} className="cartao-titulo quadro-descricao">
          {o.descricao}
        </p>
        <p className="cartao-meta quadro-rodape">
          <span className="quadro-info">
            <User size={14} aria-hidden />
            {o.registrado_por_nome ?? 'Pessoa não identificada'}
          </span>
          <span aria-hidden>·</span>
          <span className="quadro-info">
            <Clock size={14} aria-hidden />
            <time dateTime={o.created_at} title={dataCompleta(o.created_at)}>
              {tempoRelativo(o.created_at)}
            </time>
          </span>
        </p>
        <label className="quadro-status">
          <span className="cartao-meta">Status</span>
          <select
            value={o.status}
            aria-describedby={`descricao-${o.id}`}
            disabled={salvandoId === o.id}
            onChange={(e) => alterarStatus(o.id, e.target.value as Status)}
          >
            {/* Delegado aparece só na ocorrência já delegada, e não dá para escolher */}
            {o.status === 'delegado' && (
              <option value="delegado" disabled>
                {ROTULO_STATUS.delegado}
              </option>
            )}
            {STATUS_ESCOLHIVEIS.map((s) => (
              <option key={s} value={s}>
                {ROTULO_STATUS[s]}
              </option>
            ))}
          </select>
        </label>
        {o.status === 'delegado' && (
          <>
            <p className="cartao-meta quadro-info quadro-responsavel">
              <UserCheck size={14} aria-hidden />
              Responsável: {delegacoes[o.id]?.ativa?.nome ?? '…'}
            </p>
            <button
              type="button"
              className="botao quadro-delegar"
              aria-describedby={`descricao-${o.id}`}
              onClick={() => setDelegando(o)}
            >
              <Repeat size={16} aria-hidden /> Trocar responsável
            </button>
          </>
        )}
        {o.status === 'concluido' && concluida && (
          <div className="quadro-comentario">
            <p className="cartao-meta quadro-info">
              <MessageSquareText size={14} aria-hidden />
              Concluída por {concluida.nome}
            </p>
            <p className="quadro-comentario-texto" title={concluida.comentario ?? undefined}>
              {concluida.comentario ?? 'Sem comentário.'}
            </p>
          </div>
        )}
        {(o.status === 'novo' || o.status === 'em_andamento') && (
          <button
            type="button"
            className="botao quadro-delegar"
            aria-describedby={`descricao-${o.id}`}
            onClick={() => setDelegando(o)}
          >
            <Send size={16} aria-hidden /> Delegar
          </button>
        )}
        {erroStatus?.id === o.id && (
          <p role="alert" className="campo-erro">
            {erroStatus.mensagem}
          </p>
        )}
      </li>
    )
  }

  return (
    <section aria-labelledby="titulo-ocorrencias">
      <h2 id="titulo-ocorrencias">Ocorrências</h2>

      {carregando && <p className="estado-vazio">Carregando…</p>}

      {erro && (
        <p role="alert" className="aviso aviso-erro">
          {erro}
        </p>
      )}

      {!carregando && !erro && itens.length === 0 && (
        <p className="estado-vazio">
          Nenhuma ocorrência registrada nos seus condomínios até agora.
        </p>
      )}

      {!carregando && !erro && itens.length > 0 && (
        <>
          <p className="subtitulo quadro-resumo">
            {visiveis.length} {visiveis.length === 1 ? 'ocorrência' : 'ocorrências'} em{' '}
            {totalCondominios} {totalCondominios === 1 ? 'condomínio' : 'condomínios'}
          </p>
          {condominios.length > 1 && (
            <label className="quadro-filtro">
              <span className="cartao-meta">Mostrar</span>
              <select
                value={filtroCondominio}
                onChange={(e) => setFiltroCondominio(e.target.value)}
              >
                <option value={TODOS}>Todos os condomínios</option>
                {condominios.map(([id, nome]) => (
                  <option key={id} value={id}>
                    {nome}
                  </option>
                ))}
              </select>
            </label>
          )}
          {erroDelegacoes && (
            <p role="alert" className="aviso aviso-erro quadro-resumo">
              Não foi possível carregar os responsáveis das tarefas delegadas.
            </p>
          )}
          {/* Abas de contagem: só aparecem no celular, onde cabe uma coluna por vez */}
          <div className="opcoes quadro-abas" aria-label="Coluna do quadro">
            {COLUNAS.map((s) => (
              <button
                key={s}
                type="button"
                className="botao"
                aria-pressed={colunaAberta === s}
                onClick={() => setColunaAberta(s)}
              >
                {ROTULO_STATUS[s]} <span className="contador">{porColuna[s].length}</span>
              </button>
            ))}
          </div>
          <div className="quadro-colunas">
            {COLUNAS.map((s) => (
              <section
                key={s}
                aria-labelledby={`coluna-${s}`}
                className={
                  colunaAberta === s ? 'quadro-coluna quadro-coluna-aberta' : 'quadro-coluna'
                }
              >
                <h3 id={`coluna-${s}`} className="quadro-coluna-titulo">
                  <span className={`quadro-ponto quadro-ponto-${s}`} aria-hidden />
                  {ROTULO_STATUS[s]} <span className="contador">{porColuna[s].length}</span>
                </h3>
                {porColuna[s].length === 0 ? (
                  <p className="estado-vazio">Nenhuma ocorrência aqui.</p>
                ) : (
                  <ul className="quadro-lista">{porColuna[s].map(cartao)}</ul>
                )}
              </section>
            ))}
          </div>
        </>
      )}

      {delegando && (
        <DelegarOcorrencia
          ocorrencia={delegando}
          responsavelAtualId={delegacoes[delegando.id]?.ativa?.funcionarioId}
          aoDelegar={(id) => {
            setItens((atuais) =>
              atuais.map((o) => (o.id === id ? { ...o, status: 'delegado' } : o)),
            )
            setVersaoDelegacoes((v) => v + 1)
          }}
          aoFechar={() => setDelegando(null)}
        />
      )}
    </section>
  )
}
