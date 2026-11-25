// Celular do funcionário (SQUAD1-68). O banco guarda só dígitos no formato do WhatsApp:
// 55 + DDD + 9 dígitos começando com 9 (ex.: 5511999998888). A validação de verdade fica no
// banco (check em funcionarios.celular); aqui é a ajuda visual e a conversão antes de enviar.

import { somenteDigitos } from './cnpj'

// DDD + 9 dígitos.
export const CELULAR_DIGITOS = 11

// Mesma regra do banco, sem o 55: DDD com dois dígitos de 1 a 9 e celular começando com 9.
const CELULAR_VALIDO = /^[1-9]{2}9\d{8}$/

// Tira o 55 de quem colou o número completo (13 dígitos). Com 11 ou menos, o 55 é o DDD
// (Santa Maria, RS), então fica.
function semCodigoDoPais(digitos: string) {
  return digitos.length > CELULAR_DIGITOS && digitos.startsWith('55') ? digitos.slice(2) : digitos
}

// Máscara (11) 99999-8888. Aceita valor parcial (enquanto o usuário digita).
export function formatarCelular(valor: string) {
  const d = semCodigoDoPais(somenteDigitos(valor)).slice(0, CELULAR_DIGITOS)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

// O que o usuário digitou → formato do banco ("5511999998888"), ou null se não for um celular
// válido. Aceita espaços, parênteses, traço, ponto e "+"; qualquer outro caractere invalida.
export function paraWhatsApp(valor: string): string | null {
  if (/[^\d\s()+.-]/.test(valor)) return null
  const digitos = somenteDigitos(valor)
  const nacional =
    digitos.length === CELULAR_DIGITOS + 2 && digitos.startsWith('55') ? digitos.slice(2) : digitos
  return CELULAR_VALIDO.test(nacional) ? `55${nacional}` : null
}

// Formato do banco → exibição ("5511999998888" → "(11) 99999-8888"). Um valor fora do formato
// volta como está, para nunca esconder o que está gravado.
export function deWhatsApp(celular: string) {
  return /^55\d{11}$/.test(celular) ? formatarCelular(celular.slice(2)) : celular
}
