import { CircleCheck, Info, Link2Off } from 'lucide-react'
import { useEffect, useState, type ReactNode, type SubmitEvent } from 'react'
import { useParams } from 'react-router-dom'
import { MarcaCaixa } from '../components/MarcaCaixa'
import { supabase } from '../lib/supabase'
import './TarefaPublica.css'

// Página pública da tarefa delegada (SQUAD1-77, US 3). O funcionário abre o link do WhatsApp
// sem login. Usa só as funções públicas do link (SQUAD1-75): o acesso vem do token, não do
// usuário. Chamadas sempre por POST (padrão do rpc), para o token não ir para logs de URL.

const LIMITE_COMENTARIO = 800

type Tarefa = {
  nome_condominio: string | null
  local: string | null
  descricao: string | null
  situacao: 'ativa' | 'concluida' | 'revogada'
}

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'invalida' }
  | { tipo: 'concluida' }
  | { tipo: 'revogada' }
  | { tipo: 'ativa'; tarefa: Tarefa }
  | { tipo: 'concluiu' }

// ver_tarefa devolve uma linha para o token que existe e nenhuma para o inválido.
async function buscarEstado(token: string): Promise<Estado> {
  const { data, error } = await supabase.rpc('ver_tarefa', { p_token: token })
  if (error) {
    console.error('Erro ao carregar a tarefa', error)
    return { tipo: 'erro' }
  }
  const tarefa = (data as Tarefa[])[0]
  if (!tarefa) return { tipo: 'invalida' }
  if (tarefa.situacao === 'ativa') return { tipo: 'ativa', tarefa }
  return { tipo: tarefa.situacao }
}

type AvisoProps = { icone: ReactNode; titulo: string; children: ReactNode }

function Aviso({ icone, titulo, children }: AvisoProps) {
  return (
    <div className="tarefa-aviso">
      <span className="tarefa-aviso-icone">{icone}</span>
      <h1>{titulo}</h1>
      <p className="subtitulo">{children}</p>
    </div>
  )
}

type FormularioProps = {
  token: string
  tarefa: Tarefa
  aoMudarEstado: (estado: Estado) => void
}

function FormularioTarefa({ token, tarefa, aoMudarEstado }: FormularioProps) {
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function concluir(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErro(null)
    setEnviando(true)

    const { error } = await supabase.rpc('concluir_tarefa', {
      p_token: token,
      p_comentario: comentario.trim() || null,
    })

    if (!error) {
      setEnviando(false)
      aoMudarEstado({ tipo: 'concluiu' })
      return
    }

    console.error('Erro ao concluir a tarefa', error)
    // O link pode ter deixado de valer com a página aberta (o síndico trocou o responsável ou
    // concluiu). Consulta de novo para mostrar o aviso certo.
    const novo = await buscarEstado(token)
    setEnviando(false)
    if (novo.tipo !== 'ativa') {
      aoMudarEstado(novo)
      return
    }
    setErro(
      error.code === '22023' ? error.message : 'Não foi possível concluir a tarefa. Tente de novo.',
    )
  }

  return (
    <>
      <h1>Tarefa</h1>
      <p className="subtitulo">{tarefa.nome_condominio}</p>

      <dl className="tarefa-dados">
        <dt>Local</dt>
        <dd>{tarefa.local || 'Local não informado'}</dd>
        <dt>O que aconteceu</dt>
        <dd className="tarefa-descricao">{tarefa.descricao}</dd>
      </dl>

      <form className="formulario" onSubmit={concluir} noValidate>
        <label className="campo">
          <span className="campo-rotulo">
            Comentário <span className="opcional">(opcional)</span>
          </span>
          <textarea
            maxLength={LIMITE_COMENTARIO}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Ex.: troquei o sifão da pia"
            aria-describedby="comentario-ajuda"
          />
          <span id="comentario-ajuda" className="tarefa-contador">
            Só o síndico vê o comentário · {comentario.length}/{LIMITE_COMENTARIO}
          </span>
        </label>

        {erro && (
          <p role="alert" className="aviso aviso-erro">
            {erro}
          </p>
        )}

        <button type="submit" className="botao botao-principal" disabled={enviando}>
          <CircleCheck size={16} aria-hidden /> {enviando ? 'Concluindo…' : 'Concluir tarefa'}
        </button>
      </form>
    </>
  )
}

export function TarefaPublica() {
  const { token = '' } = useParams()
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })

  // Sobe a cada "Tentar de novo", para a busca passar pelo mesmo efeito (e pela mesma proteção
  // contra resposta que chega depois de sair da página).
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true
    buscarEstado(token).then((novo) => {
      if (ativo) setEstado(novo)
    })
    return () => {
      ativo = false
    }
  }, [token, tentativa])

  function tentarDeNovo() {
    setEstado({ tipo: 'carregando' })
    setTentativa((t) => t + 1)
  }

  let conteudo: ReactNode
  switch (estado.tipo) {
    case 'carregando':
      conteudo = <p className="estado-vazio">Carregando…</p>
      break
    case 'erro':
      conteudo = (
        <div className="formulario">
          <p role="alert" className="aviso aviso-erro">
            Não foi possível carregar a tarefa. Confira a internet e tente de novo.
          </p>
          <button type="button" className="botao" onClick={tentarDeNovo}>
            Tentar de novo
          </button>
        </div>
      )
      break
    case 'ativa':
      conteudo = <FormularioTarefa token={token} tarefa={estado.tarefa} aoMudarEstado={setEstado} />
      break
    case 'concluiu':
      conteudo = (
        <Aviso icone={<CircleCheck size={24} aria-hidden />} titulo="Tarefa concluída">
          Obrigado! O síndico já vê a tarefa como concluída.
        </Aviso>
      )
      break
    case 'concluida':
      conteudo = (
        <Aviso icone={<CircleCheck size={24} aria-hidden />} titulo="Tarefa encerrada">
          Esta tarefa já foi encerrada. Não é preciso fazer mais nada.
        </Aviso>
      )
      break
    case 'revogada':
      conteudo = (
        <Aviso icone={<Info size={24} aria-hidden />} titulo="Tarefa não atribuída">
          Esta tarefa não está mais atribuída a você. Se tiver dúvida, fale com o síndico.
        </Aviso>
      )
      break
    case 'invalida':
      conteudo = (
        <Aviso icone={<Link2Off size={24} aria-hidden />} titulo="Link inválido">
          Este link não existe ou está incompleto. Confira a mensagem que você recebeu.
        </Aviso>
      )
      break
  }

  return (
    <main className="tela-centralizada">
      <div className="caixa" aria-live="polite">
        <MarcaCaixa />
        {conteudo}
      </div>
    </main>
  )
}
