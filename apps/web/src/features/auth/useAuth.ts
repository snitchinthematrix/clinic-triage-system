import { createContext, useContext } from 'react'
import type { User } from '@supabase/supabase-js'

export type Role = 'patient' | 'doctor' | 'front_desk'

export interface AuthState {
  user: User | null
  role: Role | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | undefined>(undefined)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
