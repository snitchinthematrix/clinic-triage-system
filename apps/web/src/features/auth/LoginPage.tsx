import { useState, type FormEvent } from 'react'
import { useAuth } from './useAuth'

export function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await signIn(email, password)
    } catch (err) {
      setError('Invalid email or password')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
      <input aria-label="Password" value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
      {error && <p role="alert">{error}</p>}
      <button type="submit">Log in</button>
    </form>
  )
}
