// Ajuda visual com o CNPJ. A validação de verdade (14 dígitos, único) fica no banco.

export const CNPJ_DIGITOS = 14

export function somenteDigitos(valor: string) {
  return valor.replace(/\D/g, '')
}

// Máscara 00.000.000/0000-00. Aceita valor parcial (enquanto o usuário digita).
export function formatarCnpj(valor: string) {
  const d = somenteDigitos(valor).slice(0, CNPJ_DIGITOS)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}
