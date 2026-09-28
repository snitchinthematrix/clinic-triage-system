import { supabase } from '../../lib/supabaseClient'

export interface TriageInput {
  symptomText: string
  durationDays: number
  bodyArea: string
  severity: number
}

export interface TriageResult {
  urgency: 'routine' | 'soon' | 'urgent' | 'emergency' | 'unknown'
  suggestedDepartment: string | null
  disclaimer: string
  symptomText: string
}

const AI_BACKEND_URL = import.meta.env.VITE_AI_BACKEND_URL

export async function submitTriage(input: TriageInput): Promise<TriageResult> {
  const { data } = await supabase.auth.getSession()
  const res = await fetch(`${AI_BACKEND_URL}/triage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session?.access_token ?? ''}`,
    },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Triage request failed')
  const body = await res.json()
  return { ...body, symptomText: input.symptomText }
}

export async function sendBookingConfirmation(input: {
  to: string
  scheduledAt: string
  doctorName: string
}): Promise<void> {
  const { data } = await supabase.auth.getSession()
  await fetch(`${AI_BACKEND_URL}/notify/appointment-confirmation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session?.access_token ?? ''}`,
    },
    body: JSON.stringify(input),
  })
}
