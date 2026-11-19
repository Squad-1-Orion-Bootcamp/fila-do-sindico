import { supabase } from '../lib/supabase'

export const SENHA_MINIMA = 6 // igual ao minimum_password_length do Supabase

// Devolve a mensagem de erro, ou null se a senha serve.
export function validarSenha(senha: string, confirmacao: string) {
  if (senha.length < SENHA_MINIMA) {
    return `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`
  }
  if (senha !== confirmacao) {
    return 'As senhas não são iguais.'
  }
  return null
}

type ResultadoCadastro = { erro: string | null; comSessao: boolean }

// dados: campos lidos pelo trigger handle_new_user (ver supabase/AGENTS.md).
export async function criarConta(
  email: string,
  senha: string,
  dados: Record<string, string>,
): Promise<ResultadoCadastro> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: { data: dados },
  })

  // Qualquer recusa cai aqui: e-mail repetido, senha fraca e também o trigger recusando o
  // cadastro, que volta como erro do banco.
  if (error) {
    console.error('Erro ao criar a conta', error)
    return {
      erro: 'Não foi possível criar a conta. Confira os dados e tente de novo.',
      comSessao: false,
    }
  }
  // Sem sessão: a confirmação de e-mail está ligada (produção).
  return { erro: null, comSessao: data.session !== null }
}
