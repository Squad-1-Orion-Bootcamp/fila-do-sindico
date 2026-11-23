import { supabase } from './supabase'

// Lista pública de condomínios do pré-cadastro do morador. O banco só deixa o visitante ler
// `id` e `nome`, e só de condomínios com gestor ativo: um select('*') dá erro de permissão.

export type CondominioPublico = {
  id: string
  nome: string
}

export async function listarCondominios(): Promise<CondominioPublico[]> {
  const { data, error } = await supabase.from('condominios').select('id, nome').order('nome')
  if (error) throw error
  return data
}
