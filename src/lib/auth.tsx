import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase, type Tables } from './supabase'

interface AuthState {
  session: Session | null
  ready: boolean
}

const AuthContext = createContext<AuthState>({ session: null, ready: false })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, ready: false })
  const queryClient = useQueryClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, ready: true }))
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setState({ session, ready: true })
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        // Anything user-scoped (balance, positions, can_trade) depends on who is signed in.
        queryClient.invalidateQueries()
      }
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useSession() {
  return useContext(AuthContext)
}

export function useUserId(): string | null {
  return useSession().session?.user.id ?? null
}

export function useProfile() {
  const userId = useUserId()
  return useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Tables<'profiles'> | null> => {
      const { data, error } = await supabase.from('profiles').select('*').eq('user_id', userId!).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useStudentProfile() {
  const userId = useUserId()
  return useQuery({
    queryKey: ['student-profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_profiles')
        .select('*, university:universities(id, name, short_name), program:programs(id, name)')
        .eq('user_id', userId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useBalance() {
  const userId = useUserId()
  return useQuery({
    queryKey: ['balance', userId],
    enabled: !!userId,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.from('accounts').select('balance').eq('user_id', userId!).single()
      if (error) throw error
      return Number(data.balance)
    },
  })
}

export async function signOut() {
  await supabase.auth.signOut()
}
