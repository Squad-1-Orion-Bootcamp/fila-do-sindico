import type { Session } from '@supabase/supabase-js'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import { fetchAcessoMorador, type AcessoMorador } from './acessoMorador'

export type Role = 'admin' | 'gestor' | 'morador'

export type Profile = {
  id: string
  role: Role
  nome: string | null
  // Só para morador; null para gestor e admin, ou se a situação não carregou.
  acesso: AcessoMorador | null
}

type AuthState = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, nome')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    console.error('Erro ao carregar o perfil', error)
    return null
  }
  if (!data) return null
  const acesso = data.role === 'morador' ? await fetchAcessoMorador(userId) : null
  return { ...data, acesso }
}

// Fora do componente: não dependem do estado, então têm sempre a mesma identidade.
async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    console.error('Erro ao entrar', error)
    return 'E-mail ou senha inválidos'
  }
  return null
}

async function signOut() {
  await supabase.auth.signOut()
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  // Usuário cujo perfil já foi pedido. Evita "Carregando…" a cada renovação de token.
  const usuarioCarregado = useRef<string | null>(null)

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (!newSession) {
        usuarioCarregado.current = null
        setProfile(null)
        setLoading(false)
        return
      }
      // Usuário novo (ex.: acabou de entrar): segura as telas até o perfil chegar,
      // senão o login vê "sessão sem perfil" e manda para /sem-acesso.
      if (usuarioCarregado.current !== newSession.user.id) {
        usuarioCarregado.current = newSession.user.id
        setLoading(true)
      }
      // Fora do callback: o Supabase recomenda não chamar a API dentro dele diretamente.
      setTimeout(async () => {
        setProfile(await fetchProfile(newSession.user.id))
        setLoading(false)
      }, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // Mesmo objeto entre renderizações, para não re-renderizar quem usa useAuth() à toa.
  const value = useMemo(
    () => ({ session, profile, loading, signIn, signOut }),
    [session, profile, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
