// Mensagem e link do WhatsApp para delegar uma ocorrência (SQUAD1-76, US 3).

// A descrição pode ter até 800 caracteres; a mensagem leva só o começo, e o link mostra o
// texto completo.
const LIMITE_DESCRICAO_NA_MENSAGEM = 300

type DadosDaMensagem = {
  nomeFuncionario: string
  nomeCondominio: string
  local: string | null
  descricao: string
  link: string
}

function resumir(descricao: string): string {
  const texto = descricao.trim().replace(/\s+/g, ' ')
  // Conta por caractere, e não por unidade UTF-16: um emoji cortado ao meio faria o
  // encodeURIComponent do link do WhatsApp falhar (URIError).
  const caracteres = Array.from(texto)
  if (caracteres.length <= LIMITE_DESCRICAO_NA_MENSAGEM) {
    // O texto do Lucas já põe o ponto depois da descrição.
    return `${texto.replace(/[.!?]+$/, '')}.`
  }
  return `${caracteres.slice(0, LIMITE_DESCRICAO_NA_MENSAGEM).join('').trimEnd()}…`
}

// Texto definido pelo Lucas na SQUAD1-76.
export function mensagemDaTarefa({
  nomeFuncionario,
  nomeCondominio,
  local,
  descricao,
  link,
}: DadosDaMensagem): string {
  // Nomes como "Condomínio Aurora" não repetem a palavra: "no Condomínio Aurora".
  const condominio = nomeCondominio.trim()
  const onde = /^condom[ií]nio(\s|$)/i.test(condominio)
    ? ` no ${condominio}`
    : condominio
      ? ` no condomínio ${condominio}`
      : ''
  const partes = [`Olá ${nomeFuncionario}, você recebeu uma nova tarefa${onde}.`]
  if (local?.trim()) partes.push(`Local: ${local.trim().replace(/[.!?]+$/, '')}.`)
  partes.push(`Problema: ${resumir(descricao)}`)
  partes.push(`Acesse o link para concluir: ${link}`)
  return partes.join(' ')
}

// O banco já guarda o celular no formato do WhatsApp (5511999998888, regra da tabela
// funcionarios). Aqui só garantimos que vão apenas dígitos para o wa.me.
export function linkDoWhatsApp(celular: string, texto: string): string {
  return `https://wa.me/${celular.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`
}

// Endereço da página pública da tarefa (SQUAD1-77) no site em que o gestor está.
export function linkDaTarefa(token: string): string {
  return `${window.location.origin}/tarefa/${token}`
}
