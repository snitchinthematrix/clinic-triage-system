import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'

export function PatientSignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError || !data.user) {
      setError(signUpError?.message ?? 'Signup failed')
      return
    }
    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id, role: 'patient', full_name: fullName,
    })
    if (profileError) {
      setError(profileError.message)
      return
    }
    await supabase.from('patients').insert({ profile_id: data.user.id })
    setDone(true)
  }

  if (done) return <p>Check your email to confirm your account.</p>

  return (
    <form onSubmit={handleSubmit}>
      <input aria-label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      <input aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
      <input aria-label="Password" value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={8} />
      {error && <p role="alert">{error}</p>}
      <button type="submit">Sign up</button>
    </form>
  )
}
