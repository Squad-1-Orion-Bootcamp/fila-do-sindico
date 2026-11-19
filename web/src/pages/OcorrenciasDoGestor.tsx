import { Clock, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { dataCompleta, tempoRelativo } from '../lib/tempo'
import './OcorrenciasDoGestor.css'

// Bloco do painel do gestor: ocorrências de todos os seus condomínios (SQUAD1-29).

type Status = 'novo' | 'em_andamento' | 'concluido'
type Urgencia = 'urgente' | 'alta' | 'normal' | 'baixa'

type Ocorrencia = {
  id: string
  condominio_id: string
  local: string | null
  descricao: string
  status: Status
  urgencia_atual: Urgencia | null
  created_at: string
  condominios: { nome: string } | null
  profiles: { nome: string } | null
}

// Mesmos rótulos da história SQUAD1-5 e da página do morador.
const ROTULO_STATUS: Record<Status, string> = {
  novo: 'Pendente',
  em_andamento: 'Em análise',
  concluido: 'Resolvido',
}

const ROTULO_URGENCIA: Record<Urgencia, string> = {
  urgente: 'Urgente',
  alta: 'Alta',
  normal: 'Normal',
  baixa: 'Baixa',
}

// Sem filtro por usuário: o RLS (ocorrencias_ler_registrante_gestor_ou_admin) já devolve só
// as ocorrências dos condomínios em que o gestor tem vínculo ativo.
function buscarOcorrencias() {
  return supabase
    .from('ocorrencias')
    .select(
      'id, condominio_id, local, descricao, status, urgencia_atual, created_at, condominios(nome), profiles(nome)',
    )
    .order('created_at', { ascending: false })
    // Sem tipos gerados, o supabase-js acha que o join devolve lista; aqui é um objeto só.
    .overrideTypes<Ocorrencia[], { merge: false }>()
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

  useEffect(() => {
    buscarOcorrencias().then(({ data, error }) => {
      if (error) {
        console.error('Erro ao carregar as ocorrências', error)
        setErro('Não foi possível carregar as ocorrências.')
      } else {
        setItens(data)
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

  // Filtro por condomínio (SQUAD1-31): só de interface, sobre o que o RLS já devolveu.
  // O padrão é ver todos os condomínios juntos.
  const condominios = [
    ...new Map(itens.map((o) => [o.condominio_id, o.condominios?.nome ?? 'Condomínio'])),
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
                  {o.condominios?.nome ?? 'Condomínio'}
                  {o.local && ` · ${o.local}`}
                </p>
                <p id={`descricao-${o.id}`} className="cartao-titulo quadro-descricao">
                  {o.descricao}
                </p>
                <p className="cartao-meta quadro-rodape">
                  <span className="quadro-info">
                    <User size={14} aria-hidden />
                    {o.profiles?.nome ?? 'Pessoa não identificada'}
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
                    {(Object.keys(ROTULO_STATUS) as Status[]).map((s) => (
                      <option key={s} value={s}>
                        {ROTULO_STATUS[s]}
                      </option>
                    ))}
                  </select>
                </label>
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
    </section>
  )
}
