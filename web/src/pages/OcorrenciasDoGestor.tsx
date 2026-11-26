import { Clock, Send, User } from 'lucide-react'
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

// Mesmos rótulos da história SQUAD1-5 e da página do morador.
const ROTULO_STATUS: Record<Status, string> = {
  novo: 'Pendente',
  em_andamento: 'Em análise',
  delegado: 'Delegado',
  concluido: 'Resolvido',
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

  useEffect(() => {
    // Rede de segurança do gatilho: pede a classificação das ocorrências que ficaram sem
    // prioridade. Não espera: a prioridade aparece no próximo carregamento.
    supabase.rpc('classificar_pendentes').then(({ error }) => {
      if (error) console.error('Erro ao pedir a classificação das pendentes', error)
    })

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
          <ul className="quadro-lista">
            {visiveis.map((o) => (
              <li
                key={o.id}
                className={o.status === 'concluido' ? 'cartao cartao-apagado' : 'cartao'}
              >
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
            ))}
          </ul>
        </>
      )}

      {delegando && (
        <DelegarOcorrencia
          ocorrencia={delegando}
          aoDelegar={(id) =>
            setItens((atuais) =>
              atuais.map((o) => (o.id === id ? { ...o, status: 'delegado' } : o)),
            )
          }
          aoFechar={() => setDelegando(null)}
        />
      )}
    </section>
  )
}
