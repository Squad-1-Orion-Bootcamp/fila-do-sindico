import { Clock, MessageSquareText, Repeat, Send, User, UserCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { dataCompleta, tempoRelativo } from '../lib/tempo'
import { DelegarOcorrencia } from './DelegarOcorrencia'
import {
  EtiquetaPrioridade,
  MotivoPrioridade,
  SeletorPrioridade,
  type DecisaoPrioridade,
  type Urgencia,
} from './PrioridadeNoCard'
import './OcorrenciasDoGestor.css'

// Bloco do painel do gestor: ocorrências de todos os seus condomínios (SQUAD1-29).

type Status = 'novo' | 'em_andamento' | 'delegado' | 'concluido'

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
  concluido_em: string | null
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

type Conclusao = { ocorrencia_id: string; created_at: string }

function buscarDelegacoes() {
  return supabase
    .from('delegacoes')
    .select('ocorrencia_id, funcionario_id, situacao, comentario, concluida_em, funcionarios(nome)')
    .in('situacao', ['ativa', 'concluida'])
    .returns<Delegacao[]>()
}

// Quando cada ocorrência foi concluída, pelo histórico de status. Serve para não mostrar o
// comentário de uma conclusão antiga, se a ocorrência foi reaberta e o gestor concluiu de novo.
function buscarConclusoes() {
  return supabase
    .from('historico_status')
    .select('ocorrencia_id, created_at')
    .eq('status_novo', 'concluido')
    .returns<Conclusao[]>()
}

// Uma ocorrência tem no máximo uma delegação ativa. O comentário só vale se a conclusão mais
// recente da ocorrência foi a do funcionário pelo link: concluir_tarefa grava a delegação e o
// histórico na mesma transação, com o mesmo horário.
function porOcorrencia(lista: Delegacao[], conclusoes: Conclusao[]): Record<string, InfoDelegacao> {
  const ultimaConclusao: Record<string, number> = {}
  for (const c of conclusoes) {
    const t = Date.parse(c.created_at)
    if (!(t <= ultimaConclusao[c.ocorrencia_id])) ultimaConclusao[c.ocorrencia_id] = t
  }
  const mapa: Record<string, InfoDelegacao> = {}
  for (const d of lista) {
    const info = (mapa[d.ocorrencia_id] ??= {})
    const nome = d.funcionarios?.nome ?? 'Funcionário'
    if (d.situacao === 'ativa') {
      info.ativa = { funcionarioId: d.funcionario_id, nome }
    } else if (
      d.concluida_em &&
      Date.parse(d.concluida_em) >= (ultimaConclusao[d.ocorrencia_id] ?? 0) &&
      (!info.concluida || d.concluida_em > info.concluida.concluidaEm)
    ) {
      info.concluida = { nome, comentario: d.comentario, concluidaEm: d.concluida_em }
    }
  }
  return mapa
}

// O comentário aparece em até 3 linhas; o "Ver tudo" só aparece quando ele pode passar disso.
// A conta é aproximada (cerca de 40 caracteres por linha num card de celular).
function comentarioLongo(comentario: string | null): boolean {
  if (!comentario) return false
  return comentario.length > 120 || comentario.split('\n').length > 3
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

// Novo, Em andamento e Delegado: mais urgentes primeiro; a ocorrência que a IA ainda não
// classificou vem depois das classificadas. Empate: a mais antiga primeiro.
// Concluído: as concluídas mais recentemente primeiro (decisão da Riane, docs/decisoes/2026-11-24-squad1-61-quadro-em-colunas.md).
const PESO_URGENCIA: Record<Urgencia, number> = { urgente: 0, alta: 1, normal: 2, baixa: 3 }

function ordemNaColuna(a: Ocorrencia, b: Ocorrencia): number {
  if (a.status === 'concluido') {
    // concluido_em sempre vem preenchido numa concluída; o '' é só para o tipo.
    return (b.concluido_em ?? '').localeCompare(a.concluido_em ?? '')
  }
  const pa = a.urgencia_atual ? PESO_URGENCIA[a.urgencia_atual] : 4
  const pb = b.urgencia_atual ? PESO_URGENCIA[b.urgencia_atual] : 4
  if (pa !== pb) return pa - pb
  return a.created_at.localeCompare(b.created_at)
}

// "Delegado" só vem pela delegação (botão Delegar), nunca pela troca de status.
const STATUS_ESCOLHIVEIS: Status[] = ['novo', 'em_andamento', 'concluido']

// A função do banco devolve só as ocorrências dos condomínios em que o gestor tem vínculo
// ativo, já das mais novas para as mais antigas. A urgência não vem de .from('ocorrencias'):
// essa coluna é fechada para o morador, e permissão por coluna vale para todo usuário logado.
function buscarOcorrencias() {
  return supabase.rpc('listar_ocorrencias_gestor')
}

// Valor do filtro que mostra todos os condomínios (a visão padrão do painel).
const TODOS = 'todos'

// Motivo da prioridade (SQUAD1-64): a frase da IA (classificacoes_ia) e a última decisão do
// gestor (decisoes). O RLS deixa só o gestor ativo do condomínio e o admin lerem as duas.
type Classificacao = { ocorrencia_id: string; justificativa: string | null; created_at: string }
type Decisao = {
  ocorrencia_id: string
  autor_id: string
  justificativa: string | null
  created_at: string
}

function buscarMotivos() {
  return Promise.all([
    supabase
      .from('classificacoes_ia')
      .select('ocorrencia_id, justificativa, created_at')
      .eq('status_processamento', 'sucesso')
      .returns<Classificacao[]>(),
    supabase
      .from('decisoes')
      .select('ocorrencia_id, autor_id, justificativa, created_at')
      .eq('acao', 'definir_prioridade')
      .returns<Decisao[]>(),
  ])
}

// Fica a mais recente de cada ocorrência.
function maisRecentes<T extends { ocorrencia_id: string; created_at: string }>(
  lista: T[],
): Record<string, T> {
  const mapa: Record<string, T> = {}
  for (const item of lista) {
    const atual = mapa[item.ocorrencia_id]
    if (!atual || item.created_at > atual.created_at) mapa[item.ocorrencia_id] = item
  }
  return mapa
}

// Mensagens que a própria função definir_prioridade_ocorrencia escreve para o usuário.
function mensagemDaPrioridade(error: { code?: string; message: string }): string {
  if (
    (error.code === '22023' || error.code === '42501') &&
    !error.message.startsWith('permission denied')
  ) {
    return error.message
  }
  return 'Não foi possível salvar a prioridade. Tente de novo.'
}

export function OcorrenciasDoGestor() {
  const { session } = useAuth()
  const meuId = session?.user.id
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
  const [motivosIA, setMotivosIA] = useState<Record<string, string | null>>({})
  const [decisoes, setDecisoes] = useState<Record<string, DecisaoPrioridade>>({})
  const [erroMotivos, setErroMotivos] = useState(false)
  // No celular o quadro mostra uma coluna por vez (DESIGN.md), escolhida nas abas.
  const [colunaAberta, setColunaAberta] = useState<Status>('novo')
  // Comentários do funcionário abertos por inteiro ("Ver tudo"), por ocorrência.
  const [comentariosAbertos, setComentariosAbertos] = useState<Set<string>>(new Set())

  function alternarComentario(id: string) {
    setComentariosAbertos((atuais) => {
      const novos = new Set(atuais)
      if (novos.has(id)) novos.delete(id)
      else novos.add(id)
      return novos
    })
  }

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
    // Ignora a resposta de uma busca antiga, se outra troca já pediu uma nova.
    let ativo = true
    Promise.all([buscarDelegacoes(), buscarConclusoes()]).then(([delegacoesLidas, conclusoes]) => {
      if (!ativo) return
      const error = delegacoesLidas.error ?? conclusoes.error
      if (error) {
        console.error('Erro ao carregar as delegações', error)
        setErroDelegacoes(true)
      } else {
        setErroDelegacoes(false)
        setDelegacoes(porOcorrencia(delegacoesLidas.data ?? [], conclusoes.data ?? []))
      }
    })
    return () => {
      ativo = false
    }
  }, [versaoDelegacoes])

  // Sem tempo real (decisão da Riane): o motivo da IA chega ao recarregar a página.
  useEffect(() => {
    let ativo = true
    buscarMotivos().then(([classificacoes, decisoesLidas]) => {
      if (!ativo) return
      const error = classificacoes.error ?? decisoesLidas.error
      if (error) {
        console.error('Erro ao carregar os motivos da prioridade', error)
        setErroMotivos(true)
        return
      }
      setErroMotivos(false)
      const ia = maisRecentes(classificacoes.data ?? [])
      setMotivosIA(Object.fromEntries(Object.entries(ia).map(([id, c]) => [id, c.justificativa])))
      const gestor = maisRecentes(decisoesLidas.data ?? [])
      setDecisoes(
        Object.fromEntries(
          Object.entries(gestor).map(([id, d]) => [
            id,
            { autorId: d.autor_id, justificativa: d.justificativa },
          ]),
        ),
      )
    })
    return () => {
      ativo = false
    }
  }, [])

  async function definirPrioridade(
    id: string,
    urgencia: Urgencia,
    justificativa: string | null,
  ): Promise<string | null> {
    const { error } = await supabase.rpc('definir_prioridade_ocorrencia', {
      p_ocorrencia_id: id,
      p_urgencia: urgencia,
      p_justificativa: justificativa,
    })
    if (error) {
      console.error('Erro ao definir a prioridade', error)
      return mensagemDaPrioridade(error)
    }
    // A escolha do gestor fica no lugar da sugestão da IA, e o card muda de lugar na coluna.
    setItens((atuais) => atuais.map((o) => (o.id === id ? { ...o, urgencia_atual: urgencia } : o)))
    if (meuId) {
      setDecisoes((atuais) => ({ ...atuais, [id]: { autorId: meuId, justificativa } }))
    }
    return null
  }

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
      // concluido_em acompanha o banco: preenchido ao concluir, limpo ao reabrir. A hora local
      // basta para pôr o card no topo de Concluído; ao recarregar, vale a do banco.
      const concluidoEm = status === 'concluido' ? new Date().toISOString() : null
      setItens((atuais) =>
        atuais.map((o) => (o.id === id ? { ...o, status, concluido_em: concluidoEm } : o)),
      )
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
        {/* A concluída que a IA não classificou fica sem etiqueta (decisão da Riane) */}
        {!(o.status === 'concluido' && !o.urgencia_atual) && (
          <EtiquetaPrioridade urgencia={o.urgencia_atual} />
        )}
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
        <MotivoPrioridade
          ocorrenciaId={o.id}
          urgencia={o.urgencia_atual}
          motivoIA={motivosIA[o.id] ?? null}
          decisao={decisoes[o.id]}
          meuId={meuId}
        />
        <SeletorPrioridade
          ocorrenciaId={o.id}
          concluida={o.status === 'concluido'}
          urgencia={o.urgencia_atual}
          decisao={decisoes[o.id]}
          aoDefinir={(urgencia, justificativa) => definirPrioridade(o.id, urgencia, justificativa)}
        />
        <label className="quadro-status">
          <span className="cartao-meta">Status</span>
          <select
            value={o.status}
            aria-describedby={
              o.status === 'delegado'
                ? `descricao-${o.id} aviso-status-${o.id}`
                : `descricao-${o.id}`
            }
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
              Responsável:{' '}
              {delegacoes[o.id]?.ativa?.nome ?? (erroDelegacoes ? 'não carregado' : '…')}
            </p>
            {/* Trocar o status revoga o link na hora ("assumir de volta"): avisa antes */}
            <p id={`aviso-status-${o.id}`} className="campo-ajuda quadro-aviso-status">
              Mudar o status tira a tarefa do funcionário, e o link dele deixa de funcionar.
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
            <p
              id={`comentario-${o.id}`}
              className={
                comentariosAbertos.has(o.id)
                  ? 'quadro-comentario-texto quadro-comentario-aberto'
                  : 'quadro-comentario-texto'
              }
            >
              {concluida.comentario ?? 'Sem comentário.'}
            </p>
            {comentarioLongo(concluida.comentario) && (
              <button
                type="button"
                className="quadro-acao-texto"
                aria-expanded={comentariosAbertos.has(o.id)}
                aria-controls={`comentario-${o.id}`}
                onClick={() => alternarComentario(o.id)}
              >
                {comentariosAbertos.has(o.id) ? 'Ver menos' : 'Ver tudo'}
              </button>
            )}
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
          {erroMotivos && (
            <p role="alert" className="aviso aviso-erro quadro-resumo">
              Não foi possível carregar os motivos das prioridades.
            </p>
          )}
          {erroDelegacoes && (
            <p role="alert" className="aviso aviso-erro quadro-resumo">
              Não foi possível carregar os responsáveis das tarefas delegadas.
            </p>
          )}
          {/* Abas de contagem: só aparecem no celular, onde cabe uma coluna por vez */}
          <div className="opcoes quadro-abas" role="group" aria-label="Coluna do quadro">
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
          trocando={delegando.status === 'delegado'}
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
