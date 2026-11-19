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
      <label className="campo">
        <span className="campo-rotulo">
          Senha <span className="obrigatorio">*</span>
        </span>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={props.senha}
          onChange={(e) => props.onSenha(e.target.value)}
        />
      </label>
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
