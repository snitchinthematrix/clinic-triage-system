import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import * as useAuthModule from './useAuth'

describe('ProtectedRoute', () => {
  it('redirects when role is not allowed', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: '1' } as any, role: 'patient', loading: false,
      signIn: vi.fn(), signOut: vi.fn(),
    })
    render(
      <MemoryRouter initialEntries={['/doctor']}>
        <ProtectedRoute allow={['doctor']}>
          <div>Doctor Dashboard</div>
        </ProtectedRoute>
      </MemoryRouter>
    )
    expect(screen.queryByText('Doctor Dashboard')).not.toBeInTheDocument()
  })

  it('renders children when role is allowed', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: '1' } as any, role: 'doctor', loading: false,
      signIn: vi.fn(), signOut: vi.fn(),
    })
    render(
      <MemoryRouter initialEntries={['/doctor']}>
        <ProtectedRoute allow={['doctor']}>
          <div>Doctor Dashboard</div>
        </ProtectedRoute>
      </MemoryRouter>
    )
    expect(screen.getByText('Doctor Dashboard')).toBeInTheDocument()
  })
})
