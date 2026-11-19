const MINUTO = 60 * 1000
const HORA = 60 * MINUTO
const DIA = 24 * HORA

// Tempo relativo das listas, como no DESIGN.md: "há 25 min", "há 2 h", "ontem".
export function tempoRelativo(iso: string, agora: Date = new Date()) {
  const data = new Date(iso)
  const diferenca = agora.getTime() - data.getTime()

  if (diferenca < MINUTO) return 'agora'
  if (diferenca < HORA) return `há ${Math.floor(diferenca / MINUTO)} min`
  if (diferenca < DIA) return `há ${Math.floor(diferenca / HORA)} h`

  // Dias contados pelo calendário: anteontem às 23h visto hoje às 8h é "há 2 dias", não "ontem".
  const dias = Math.round((inicioDoDia(agora) - inicioDoDia(data)) / DIA)
  if (dias <= 1) return 'ontem'
  if (dias < 30) return `há ${dias} dias`
  return data.toLocaleDateString('pt-BR')
}

function inicioDoDia(data: Date) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate()).getTime()
}

export function dataCompleta(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
