import { MessageCircle, Send } from 'lucide-react'
import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import { supabase } from '../lib/supabase'
import { linkDaTarefa, linkDoWhatsApp, mensagemDaTarefa } from '../lib/whatsapp'
import './DelegarOcorrencia.css'

// Janela "Delegar" do card do painel (SQUAD1-76, US 3): o gestor escolhe um funcionário ativo
// do condomínio, o banco gera o link e o gestor abre o WhatsApp com a mensagem pronta.
// O WhatsApp abre por um clique do gestor: aberto sozinho, o navegador bloqueia a janela.

export type OcorrenciaParaDelegar = {
  id: string
  condominio_id: string
  condominio_nome: string | null
  local: string | null
  descricao: string
}

type Funcionario = {
  id: string
  nome: string
  celular: string
  funcao: string
}

type Props = {
  ocorrencia: OcorrenciaParaDelegar
  // Na troca de responsável (SQUAD1-78), quem está com a tarefa agora.
  responsavelAtualId?: string
  aoDelegar: (ocorrenciaId: string) => void
  aoFechar: () => void
}

// Mensagens que a própria função delegar_ocorrencia escreve para o usuário.
function mensagemDeErro(error: { code?: string; message: string }): string {
  if (
    (error.code === '22023' || error.code === '42501') &&
    !error.message.startsWith('permission denied')
  ) {
    return error.message
  }
  return 'Não foi possível delegar a ocorrência. Tente de novo.'
}

export function DelegarOcorrencia({
  ocorrencia,
  responsavelAtualId,
  aoDelegar,
  aoFechar,
}: Props) {
  const trocando = Boolean(responsavelAtualId)
  const janela = useRef<HTMLDialogElement>(null)
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroLista, setErroLista] = useState<string | null>(null)
  const [escolhido, setEscolhido] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [delegado, setDelegado] = useState<{ nome: string; whatsapp: string } | null>(null)

  useEffect(() => {
    janela.current?.showModal()
  }, [])

  // O RLS devolve só os funcionários dos condomínios em que o gestor tem vínculo ativo.
  useEffect(() => {
    supabase
      .from('funcionarios')
      .select('id, nome, celular, funcao')
      .eq('condominio_id', ocorrencia.condominio_id)
      .eq('ativo', true)
      .order('nome')
      .returns<Funcionario[]>()
      .then(({ data, error }) => {
        if (error) {
          console.error('Erro ao carregar os funcionários', error)
          setErroLista('Não foi possível carregar os funcionários.')
        } else {
          setFuncionarios(data)
        }
        setCarregando(false)
      })
  }, [ocorrencia.condominio_id])

  async function delegar(evento: SubmitEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErro(null)
    const funcionario = funcionarios.find((f) => f.id === escolhido)
    if (!funcionario) {
      setErro('Escolha um funcionário.')
      return
    }

    setEnviando(true)
    const { data: token, error } = await supabase.rpc('delegar_ocorrencia', {
      p_ocorrencia_id: ocorrencia.id,
      p_funcionario_id: funcionario.id,
    })
    setEnviando(false)

    if (error) {
      console.error('Erro ao delegar a ocorrência', error)
      setErro(mensagemDeErro(error))
      return
    }

    // O token só volta agora: o banco guarda apenas o hash.
    const texto = mensagemDaTarefa({
      nomeFuncionario: funcionario.nome,
      nomeCondominio: ocorrencia.condominio_nome ?? '',
      local: ocorrencia.local,
      descricao: ocorrencia.descricao,
      link: linkDaTarefa(token as string),
    })
    setDelegado({ nome: funcionario.nome, whatsapp: linkDoWhatsApp(funcionario.celular, texto) })
    aoDelegar(ocorrencia.id)
  }

  return (
    <dialog
      ref={janela}
      className="janela"
      aria-labelledby="delegar-titulo"
      onClose={aoFechar}
    >
      <h2 id="delegar-titulo">{delegado ? 'Ocorrência delegada' : trocando ? 'Trocar responsável' : 'Delegar ocorrência'}</h2>
      <p className="cartao-meta janela-ocorrencia">
        {ocorrencia.condominio_nome ?? 'Condomínio'}
        {ocorrencia.local && ` · ${ocorrencia.local}`}
      </p>

      {delegado ? (
        <div className="formulario">
          <p>
            Agora envie o link para <strong>{delegado.nome}</strong> pelo WhatsApp.
          </p>
          <a
            className="botao botao-principal"
            href={delegado.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle size={16} aria-hidden /> Abrir WhatsApp
          </a>
          <p className="campo-ajuda">
            O link só aparece agora. Se fechar sem enviar, delegue de novo para gerar outro.
          </p>
          <button type="button" className="botao" onClick={() => janela.current?.close()}>
            Fechar
          </button>
        </div>
      ) : (
        <form className="formulario" onSubmit={delegar} noValidate>
          {carregando && <p className="estado-vazio">Carregando…</p>}
          {erroLista && (
            <p role="alert" className="aviso aviso-erro">
              {erroLista}
            </p>
          )}
          {!carregando && !erroLista && funcionarios.length === 0 && (
            <p className="estado-vazio">Nenhum funcionário ativo cadastrado neste condomínio.</p>
          )}
          {funcionarios.length > 0 && (
            <fieldset className="janela-funcionarios">
              <legend className="campo-rotulo">Para quem?</legend>
              {funcionarios.map((f) => (
                <label key={f.id} className="janela-opcao">
                  <input
                    type="radio"
                    name="funcionario"
                    value={f.id}
                    checked={escolhido === f.id}
                    onChange={() => setEscolhido(f.id)}
                  />
                  <span>
                    <span className="janela-opcao-nome">{f.nome}</span>
                    <span className="cartao-meta">
                      {f.funcao}
                      {f.id === responsavelAtualId && ' · responsável atual'}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          {trocando && funcionarios.length > 0 && (
            <p className="campo-ajuda">
              O link de quem está com a tarefa deixa de funcionar. Escolher a mesma pessoa gera um
              link novo para mandar de novo.
            </p>
          )}

          {erro && (
            <p role="alert" className="aviso aviso-erro">
              {erro}
            </p>
          )}

          <div className="janela-acoes">
            <button type="button" className="botao" onClick={() => janela.current?.close()}>
              Cancelar
            </button>
            {funcionarios.length > 0 && (
              <button type="submit" className="botao botao-principal" disabled={enviando}>
                <Send size={16} aria-hidden /> {enviando ? 'Delegando…' : trocando ? 'Trocar' : 'Delegar'}
              </button>
            )}
          </div>
        </form>
      )}
    </dialog>
  )
}
