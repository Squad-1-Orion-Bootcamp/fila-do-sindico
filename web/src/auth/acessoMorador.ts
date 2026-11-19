import { supabase } from '../lib/supabase'

// Situação do morador no condomínio: decide se ele entra em "Minhas ocorrências" ou fica
// em /sem-acesso. O RLS deixa cada morador ler só os próprios vínculos e pedidos.
export type SituacaoMorador = 'ativo' | 'pendente' | 'recusado' | 'encerrado' | 'sem_pedido'

export type AcessoMorador = {
  situacao: SituacaoMorador
  motivoRecusa: string | null
}

export async function fetchAcessoMorador(userId: string): Promise<AcessoMorador | null> {
  const [vinculos, pedidos] = await Promise.all([
    supabase
      .from('vinculos')
      .select('status')
      .eq('usuario_id', userId)
      .in('tipo', ['morador', 'funcionario']),
    supabase
      .from('solicitacoes_vinculo')
      .select('status, motivo_recusa')
      .eq('solicitante_id', userId)
      .order('created_at', { ascending: false }),
  ])
  if (vinculos.error || pedidos.error) {
    console.error('Erro ao carregar a situação do morador', vinculos.error ?? pedidos.error)
    return null
  }

  // Um vínculo ativo libera o acesso, mesmo que exista outro pedido em análise.
  if (vinculos.data.some((v) => v.status === 'ativo')) {
    return { situacao: 'ativo', motivoRecusa: null }
  }
  if (pedidos.data.some((p) => p.status === 'pendente')) {
    return { situacao: 'pendente', motivoRecusa: null }
  }
  // Pedidos vêm do mais recente para o mais antigo.
  const ultimoPedido = pedidos.data[0]
  if (ultimoPedido?.status === 'recusada') {
    return { situacao: 'recusado', motivoRecusa: ultimoPedido.motivo_recusa }
  }
  if (vinculos.data.length > 0) {
    return { situacao: 'encerrado', motivoRecusa: null }
  }
  return { situacao: 'sem_pedido', motivoRecusa: null }
}
