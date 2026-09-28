import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
    from: vi.fn(),
  },
}))

function Probe() {
  const { loading, role, user } = useAuth()
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="role">{role ?? 'none'}</span>
      <span data-testid="user">{user?.id ?? 'none'}</span>
    </div>
  )
}

describe('AuthProvider', () => {
  let authStateCallback: (event: string, session: any) => void

  beforeEach(() => {
    ;(supabase.auth.getSession as any).mockResolvedValue({ data: { session: null } })
    ;(supabase.auth.onAuthStateChange as any).mockImplementation((cb: any) => {
      authStateCallback = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })
    ;(supabase.from as any).mockReturnValue({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { role: 'doctor' } }) }) }),
    })
  })

  it('stays loading until the role has actually loaded after a sign-in event, so ProtectedRoute never sees role=null while loading=false', async () => {
    // Hold the role query open so the intermediate loading=true window
    // (between the sign-in event and the role query resolving) can
    // actually be observed instead of racing past it.
    let resolveRoleQuery: (v: { data: { role: string } }) => void
    const roleQueryPromise = new Promise<{ data: { role: string } }>((resolve) => {
      resolveRoleQuery = resolve
    })
    ;(supabase.from as any).mockReturnValue({
      select: () => ({ eq: () => ({ single: () => roleQueryPromise }) }),
    })

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))

    // Simulate Supabase firing a SIGNED_IN auth state change.
    authStateCallback('SIGNED_IN', { user: { id: 'user-1' } })

    // Immediately after the event fires (before the role query resolves),
    // loading must be true — otherwise ProtectedRoute would see
    // loading=false with role still null and redirect to /login.
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('true'))
    expect(screen.getByTestId('role')).toHaveTextContent('none')

    resolveRoleQuery!({ data: { role: 'doctor' } })

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
      expect(screen.getByTestId('role')).toHaveTextContent('doctor')
    })
  })

  it('does not call a Supabase query synchronously inside the onAuthStateChange callback (deadlock pitfall)', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))

    authStateCallback('SIGNED_IN', { user: { id: 'user-1' } })
    // supabase.from() must not have been called synchronously within the
    // callback itself — only after it yields back to the event loop.
    expect(supabase.from).not.toHaveBeenCalled()

    await waitFor(() => expect(supabase.from).toHaveBeenCalled())
  })
})
