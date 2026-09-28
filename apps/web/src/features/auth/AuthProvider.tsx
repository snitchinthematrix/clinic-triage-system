import { useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabaseClient'
import { AuthContext, type Role } from './useAuth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setUser(data.session?.user ?? null)
      if (data.session?.user) await loadRole(data.session.user.id)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      // Never call another Supabase method synchronously inside this
      // callback — supabase-js can deadlock waiting on its own internal
      // auth lock. Deferring with setTimeout(0) breaks out of the
      // callback's call stack before making the next request.
      setTimeout(() => {
        setUser(session?.user ?? null)
        if (session?.user) {
          setLoading(true)
          loadRole(session.user.id).finally(() => setLoading(false))
        } else {
          setRole(null)
          setLoading(false)
        }
      }, 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function loadRole(userId: string) {
    const { data } = await supabase.from('profiles').select('role').eq('id', userId).single()
    setRole((data?.role as Role) ?? null)
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, role, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
