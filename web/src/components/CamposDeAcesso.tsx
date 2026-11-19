import { CircleCheck } from 'lucide-react'
import { useId } from 'react'
import { SENHA_MINIMA } from '../auth/cadastro'

type Props = {
  email: string
  senha: string
  confirmacao: string
  onEmail: (valor: string) => void
  onSenha: (valor: string) => void
  onConfirmacao: (valor: string) => void
}

// E-mail, senha e confirmação dos cadastros. Sem minLength na senha: a validação fica em
// validarSenha(), para aparecer a nossa mensagem, e não o balão do navegador.
export function CamposDeAcesso(props: Props) {
  const idSenha = useId()
  const idAjudaSenha = useId()
  // Neutra até atender a regra: nada de erro enquanto a pessoa ainda digita.
  const senhaAtende = props.senha.length >= SENHA_MINIMA

  return (
    <>
      <label className="campo">
        <span className="campo-rotulo">
          E-mail <span className="obrigatorio">*</span>
        </span>
        <input
          type="email"
          required
          autoComplete="email"
          value={props.email}
          onChange={(e) => props.onEmail(e.target.value)}
        />
      </label>
      {/* div, e não label: a ajuda dentro do label entraria no nome do campo. */}
      <div className="campo">
        <label className="campo-rotulo" htmlFor={idSenha}>
          Senha <span className="obrigatorio">*</span>
        </label>
        <input
          id={idSenha}
          type="password"
          required
          autoComplete="new-password"
          aria-describedby={idAjudaSenha}
          value={props.senha}
          onChange={(e) => props.onSenha(e.target.value)}
        />
        <span
          id={idAjudaSenha}
          className={senhaAtende ? 'campo-ajuda campo-ajuda-ok' : 'campo-ajuda'}
        >
          {senhaAtende && <CircleCheck size={16} role="img" aria-label="Atendido:" />}
          Mínimo de {SENHA_MINIMA} caracteres
        </span>
      </div>
      <label className="campo">
        <span className="campo-rotulo">
          Confirmar senha <span className="obrigatorio">*</span>
        </span>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={props.confirmacao}
          onChange={(e) => props.onConfirmacao(e.target.value)}
        />
      </label>
    </>
  )
}
