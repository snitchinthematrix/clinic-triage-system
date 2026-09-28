import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PatientSignupPage } from './PatientSignupPage'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { auth: { signUp: vi.fn() }, from: vi.fn() },
}))

describe('PatientSignupPage', () => {
  it('passes full name as signUp metadata instead of inserting profiles/patients directly', async () => {
    ;(supabase.auth.signUp as any).mockResolvedValue({
      data: { user: { id: 'user-1' }, session: null },
      error: null,
    })
    render(<PatientSignupPage />)
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'alice@example.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } })
    fireEvent.click(screen.getByText(/sign up/i))

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument()
    })

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'alice@example.com',
      password: 'password123',
      options: { data: { full_name: 'Alice' } },
    })
    // Row provisioning is now done server-side by the on_auth_user_created
    // trigger (supabase/migrations/0003_auth_provisioning_and_read_policies.sql),
    // never by the client — closes the privilege-escalation hole where a
    // client could insert its own profiles row with an arbitrary role.
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('shows the signup error message when signUp fails', async () => {
    ;(supabase.auth.signUp as any).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Email already registered' },
    })
    render(<PatientSignupPage />)
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'alice@example.com' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } })
    fireEvent.click(screen.getByText(/sign up/i))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/already registered/i)
    })
  })
})
