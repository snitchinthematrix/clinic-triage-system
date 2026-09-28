import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth, type Role } from './useAuth'

export function ProtectedRoute({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const { role, loading } = useAuth()
  if (loading) return null
  if (!role || !allow.includes(role)) return <Navigate to="/login" replace />
  return <>{children}</>
}
