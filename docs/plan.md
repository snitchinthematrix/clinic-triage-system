# Clinic Appointment & Patient Triage System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v1 clinic appointment + AI triage system: patient/doctor/front-desk roles, AI symptom triage, AI visit-note summarization, heuristic no-show risk, email notifications — deployed entirely on free-tier infrastructure.

**Architecture:** A React (Vite, TypeScript) SPA talks directly to Supabase (Postgres + Auth + Storage, RLS-enforced per role) for all CRUD, and to a small standalone Node/Express (TypeScript) AI backend for the two Gemini-powered features (triage classification, visit-note summarization). The AI backend holds the only Gemini API key and is never called from a context that exposes it to the browser.

**Tech Stack:** React + Vite + TypeScript, Tailwind CSS + shadcn/ui, Supabase (Postgres/Auth/Storage), Node.js + Express + TypeScript (AI backend), Google Gemini API (free tier), Vitest + React Testing Library (frontend tests), Vitest + Supertest (backend tests), Resend (email), Vercel (frontend hosting), Render (AI backend hosting).

**Spec:** `docs/spec.md` (see also `docs/intent.md` for the why)

## Global Constraints

- Zero paid infrastructure: every hosted piece must run on a free tier (Vercel, Supabase, Render, Gemini free tier, Resend free tier).
- The Gemini API key and the Supabase service-role key must never appear in frontend code or be sent to the browser — they live only in the AI backend's server-side environment variables.
- All data access control is enforced via Supabase Row-Level Security (RLS) policies at the database level, not just in application code.
- Notifications in v1 are email-only; no SMS/push.
- No-show risk scoring in v1 is a deterministic heuristic, not an LLM/ML call.
- Any AI-generated triage response classified as `emergency` must surface an immediate "call emergency services" message before any booking UI is shown.
- Front-desk role accounts must not be able to read clinical note content (`visit_notes.doctor_raw_notes`, `ai_structured_summary`), only scheduling/admin fields.

## Review Focus

- Emergency-classified triage results must short-circuit straight to an emergency banner, never silently continue into the normal booking form — tested in Task 3.1.
- Front-desk accounts must be blocked by RLS from reading `visit_notes` clinical content even via direct API calls, not just hidden in the UI — tested in Task 1.2.
- The AI backend must degrade gracefully (return a safe "unable to triage, please call the clinic" response) when the Gemini API call fails or times out, rather than crashing the request or leaving the patient stuck — tested in Task 2.2.
- Two front-desk/patient actions booking the same doctor+time slot concurrently must be prevented by a database constraint, not just client-side checks — tested in Task 3.2.
- A patient must be blocked by RLS from reading another patient's appointments or triage submissions, even by guessing an ID — tested in Task 1.2.

---

## Milestone 1: Foundations, Data Model & Auth

Produces: a running (locally) monorepo with a Supabase-backed Postgres schema, RLS policies enforcing the three roles, and a working signup/login flow with role-based route protection. This is the base every later milestone depends on.

### Task 1.1: Monorepo & tooling scaffold

**Files:**
- Create: `package.json` (root, npm workspaces)
- Create: `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/tsconfig.json`
- Create: `apps/ai-backend/package.json`, `apps/ai-backend/tsconfig.json`
- Create: `apps/web/src/App.tsx`, `apps/web/src/main.tsx`, `apps/web/index.html`
- Create: `apps/ai-backend/src/server.ts`
- Test: `apps/web/src/App.test.tsx`, `apps/ai-backend/src/server.test.ts`

**Interfaces:**
- Produces: `apps/web` (Vite React app, dev server on :5173), `apps/ai-backend` (Express app exported as `app` from `apps/ai-backend/src/server.ts`, listening on :4000 when run directly)

- [ ] **Step 1: Create root workspace `package.json`**

```json
{
  "name": "clinic-triage-system",
  "private": true,
  "workspaces": ["apps/web", "apps/ai-backend"],
  "scripts": {
    "dev:web": "npm run dev -w apps/web",
    "dev:ai": "npm run dev -w apps/ai-backend",
    "test": "npm run test -w apps/web && npm run test -w apps/ai-backend"
  }
}
```

- [ ] **Step 2: Scaffold `apps/web` with Vite (React + TS + Vitest)**

```bash
npm create vite@latest apps/web -- --template react-ts
cd apps/web && npm install && npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
cd ../..
```

Add to `apps/web/package.json` scripts: `"test": "vitest run"`. Add `apps/web/vite.config.ts` test config:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true, setupFiles: './src/setupTests.ts' },
})
```

```ts
// apps/web/src/setupTests.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 3: Write failing smoke test for the web app**

```tsx
// apps/web/src/App.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the app shell', () => {
    render(<App />)
    expect(screen.getByText(/clinic/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Run test, verify it fails**

Run: `npm run test -w apps/web`
Expected: FAIL — text "clinic" not found (default Vite template renders "Vite + React")

- [ ] **Step 5: Replace default `App.tsx` with a minimal shell**

```tsx
// apps/web/src/App.tsx
export default function App() {
  return <div>Clinic Triage System</div>
}
```

- [ ] **Step 6: Run test, verify it passes**

Run: `npm run test -w apps/web`
Expected: PASS

- [ ] **Step 7: Scaffold `apps/ai-backend` with Express + TS + Vitest + Supertest**

```bash
mkdir -p apps/ai-backend/src
cd apps/ai-backend
npm init -y
npm install express
npm install -D typescript tsx vitest supertest @types/express @types/supertest @types/node
npx tsc --init --rootDir src --outDir dist --module commonjs --target es2020 --esModuleInterop
cd ../..
```

Add to `apps/ai-backend/package.json` scripts:

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "test": "vitest run",
    "build": "tsc"
  }
}
```

- [ ] **Step 8: Write failing test for a health check endpoint**

```ts
// apps/ai-backend/src/server.test.ts
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from './server'

describe('GET /health', () => {
  it('returns 200 ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})
```

- [ ] **Step 9: Run test, verify it fails**

Run: `npm run test -w apps/ai-backend`
Expected: FAIL — `./server` has no exported `app` yet

- [ ] **Step 10: Implement minimal server**

```ts
// apps/ai-backend/src/server.ts
import express from 'express'

export const app = express()
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

if (require.main === module) {
  const port = process.env.PORT ?? 4000
  app.listen(port, () => console.log(`AI backend listening on ${port}`))
}
```

- [ ] **Step 11: Run tests, verify both pass**

Run: `npm run test`
Expected: PASS for both workspaces

- [ ] **Step 12: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold web app and AI backend workspaces"
```

### Task 1.2: Supabase schema, migrations & RLS policies

**Files:**
- Create: `supabase/migrations/0001_init_schema.sql`
- Create: `supabase/migrations/0002_rls_policies.sql`
- Create: `apps/web/src/lib/supabaseClient.ts`
- Test: `supabase/tests/rls.test.sql` (pgTAP, run via Supabase CLI) — described below with equivalent assertions

**Interfaces:**
- Produces: Postgres tables `profiles`, `doctors`, `patients`, `appointments`, `triage_submissions`, `visit_notes`, `no_show_scores`, `notifications`; `supabaseClient` (typed Supabase JS client) exported from `apps/web/src/lib/supabaseClient.ts` as `supabase`.

- [ ] **Step 1: Install and initialize Supabase CLI locally**

```bash
npm install -D supabase
npx supabase init
npx supabase start
```

- [ ] **Step 2: Write the schema migration**

```sql
-- supabase/migrations/0001_init_schema.sql
create type user_role as enum ('patient', 'doctor', 'front_desk');
create type appointment_status as enum ('booked', 'checked_in', 'in_progress', 'done', 'cancelled', 'no_show');
create type triage_urgency as enum ('routine', 'soon', 'urgent', 'emergency');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null,
  full_name text not null,
  phone text,
  created_at timestamptz not null default now()
);

create table doctors (
  profile_id uuid primary key references profiles(id) on delete cascade,
  specialty text not null,
  working_hours jsonb not null default '{}'::jsonb
);

create table patients (
  profile_id uuid primary key references profiles(id) on delete cascade,
  date_of_birth date,
  insurance_info text
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(profile_id),
  doctor_id uuid not null references doctors(profile_id),
  scheduled_at timestamptz not null,
  status appointment_status not null default 'booked',
  urgency_level triage_urgency,
  source text not null check (source in ('self_booked', 'front_desk')),
  created_at timestamptz not null default now(),
  unique (doctor_id, scheduled_at)
);

create table triage_submissions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(profile_id),
  appointment_id uuid references appointments(id),
  symptom_text text not null,
  ai_urgency triage_urgency,
  ai_suggested_department text,
  ai_raw_response jsonb,
  created_at timestamptz not null default now()
);

create table visit_notes (
  appointment_id uuid primary key references appointments(id),
  doctor_raw_notes text not null,
  ai_structured_summary text,
  ai_patient_summary text,
  updated_at timestamptz not null default now()
);

create table no_show_scores (
  appointment_id uuid primary key references appointments(id),
  risk_score numeric not null check (risk_score >= 0 and risk_score <= 1),
  computed_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles(id),
  type text not null,
  channel text not null default 'email',
  status text not null default 'pending',
  sent_at timestamptz
);
```

The `unique (doctor_id, scheduled_at)` constraint is the database-level guard against double-booking (Review Focus item).

- [ ] **Step 3: Write the RLS policies migration**

```sql
-- supabase/migrations/0002_rls_policies.sql
alter table profiles enable row level security;
alter table doctors enable row level security;
alter table patients enable row level security;
alter table appointments enable row level security;
alter table triage_submissions enable row level security;
alter table visit_notes enable row level security;
alter table no_show_scores enable row level security;
alter table notifications enable row level security;

create function current_role_value() returns user_role
language sql stable as $$
  select role from profiles where id = auth.uid()
$$;

-- profiles: everyone can read their own profile
create policy profiles_self_select on profiles for select
  using (id = auth.uid());

-- patients: patient reads/writes own row; doctors/front_desk read all
create policy patients_self on patients for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
create policy patients_staff_read on patients for select
  using (current_role_value() in ('doctor', 'front_desk'));

-- appointments: patient sees own; doctor sees own schedule; front_desk sees all
create policy appointments_patient on appointments for all
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());
create policy appointments_doctor_read on appointments for select
  using (doctor_id = auth.uid());
create policy appointments_doctor_update on appointments for update
  using (doctor_id = auth.uid());
create policy appointments_front_desk on appointments for all
  using (current_role_value() = 'front_desk')
  with check (current_role_value() = 'front_desk');

-- triage_submissions: patient owns; doctor reads for their appointments
create policy triage_patient on triage_submissions for all
  using (patient_id = auth.uid())
  with check (patient_id = auth.uid());
create policy triage_doctor_read on triage_submissions for select
  using (
    appointment_id in (select id from appointments where doctor_id = auth.uid())
  );

-- visit_notes: doctor owns for their appointment; patient reads only ai_patient_summary
-- (enforced at column level in the API layer — front_desk gets NO access at all)
create policy visit_notes_doctor on visit_notes for all
  using (appointment_id in (select id from appointments where doctor_id = auth.uid()))
  with check (appointment_id in (select id from appointments where doctor_id = auth.uid()));
create policy visit_notes_patient_read on visit_notes for select
  using (appointment_id in (select id from appointments where patient_id = auth.uid()));
-- deliberately: no policy grants front_desk any access to visit_notes

-- no_show_scores: front_desk and the owning doctor can read
create policy no_show_front_desk on no_show_scores for select
  using (current_role_value() = 'front_desk');
create policy no_show_doctor on no_show_scores for select
  using (appointment_id in (select id from appointments where doctor_id = auth.uid()));

-- notifications: recipient reads own
create policy notifications_self on notifications for select
  using (recipient_id = auth.uid());
```

- [ ] **Step 4: Write RLS regression tests (pgTAP) covering the Review Focus items**

```sql
-- supabase/tests/rls.test.sql
begin;
select plan(3);

-- setup: two patients, one front_desk user, one appointment/visit_note (fixtures omitted for brevity,
-- created via supabase test helpers / seed script referenced in supabase/tests/seed.sql)

-- 1. patient A cannot select patient B's appointments
select is_empty(
  $$ select * from appointments where patient_id = 'patient-b-uuid' $$,
  'patient A cannot read patient B appointments'
) ;

-- wrapped as patient A session via set_config('request.jwt.claims', ...)

-- 2. front_desk cannot select any row from visit_notes
select is_empty(
  $$ select * from visit_notes $$,
  'front_desk cannot read visit_notes at all'
);

-- 3. inserting a second appointment for the same doctor+time fails
select throws_ok(
  $$ insert into appointments (patient_id, doctor_id, scheduled_at, source)
     values ('patient-a-uuid', 'doctor-a-uuid', '2026-10-01 09:00+00', 'front_desk') $$,
  '23505',
  null,
  'duplicate doctor+time slot is rejected by the unique constraint'
);

select * from finish();
rollback;
```

- [ ] **Step 5: Run migrations and RLS tests locally**

Run: `npx supabase db reset` then `npx supabase test db`
Expected: all pgTAP assertions PASS

- [ ] **Step 6: Add the typed Supabase client for the frontend**

```ts
// apps/web/src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(url, anonKey)
```

- [ ] **Step 7: Commit**

```bash
git add supabase apps/web/src/lib/supabaseClient.ts
git commit -m "feat: add Supabase schema, RLS policies, and typed client"
```

### Task 1.3: Auth — signup, login, role-based routing

**Files:**
- Create: `apps/web/src/features/auth/AuthProvider.tsx`
- Create: `apps/web/src/features/auth/useAuth.ts`
- Create: `apps/web/src/features/auth/LoginPage.tsx`
- Create: `apps/web/src/features/auth/PatientSignupPage.tsx`
- Create: `apps/web/src/features/auth/ProtectedRoute.tsx`
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/features/auth/ProtectedRoute.test.tsx`

**Interfaces:**
- Consumes: `supabase` from `apps/web/src/lib/supabaseClient.ts` (Task 1.2)
- Produces: `useAuth()` hook returning `{ user, role, loading, signIn, signOut }`; `<ProtectedRoute allow={['doctor']}>` component

- [ ] **Step 1: Write failing test for role-gated routing**

```tsx
// apps/web/src/features/auth/ProtectedRoute.test.tsx
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
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm run test -w apps/web`
Expected: FAIL — `./ProtectedRoute` and `./useAuth` do not exist yet

- [ ] **Step 3: Install routing dependency**

```bash
npm install -w apps/web react-router-dom
```

- [ ] **Step 4: Implement `useAuth` and `AuthProvider`**

```tsx
// apps/web/src/features/auth/useAuth.ts
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
```

```tsx
// apps/web/src/features/auth/AuthProvider.tsx
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
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
      setUser(session?.user ?? null)
      if (session?.user) await loadRole(session.user.id)
      else setRole(null)
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
```

- [ ] **Step 5: Implement `ProtectedRoute`**

```tsx
// apps/web/src/features/auth/ProtectedRoute.tsx
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth, type Role } from './useAuth'

export function ProtectedRoute({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const { role, loading } = useAuth()
  if (loading) return null
  if (!role || !allow.includes(role)) return <Navigate to="/login" replace />
  return <>{children}</>
}
```

- [ ] **Step 6: Run tests, verify they pass**

Run: `npm run test -w apps/web`
Expected: PASS

- [ ] **Step 7: Implement `LoginPage` and `PatientSignupPage`**

```tsx
// apps/web/src/features/auth/LoginPage.tsx
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
```

```tsx
// apps/web/src/features/auth/PatientSignupPage.tsx
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
```

- [ ] **Step 8: Wire routes in `App.tsx`**

```tsx
// apps/web/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './features/auth/AuthProvider'
import { LoginPage } from './features/auth/LoginPage'
import { PatientSignupPage } from './features/auth/PatientSignupPage'
import { ProtectedRoute } from './features/auth/ProtectedRoute'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<PatientSignupPage />} />
          <Route
            path="/patient/*"
            element={<ProtectedRoute allow={['patient']}><div>Patient area</div></ProtectedRoute>}
          />
          <Route
            path="/doctor/*"
            element={<ProtectedRoute allow={['doctor']}><div>Doctor area</div></ProtectedRoute>}
          />
          <Route
            path="/front-desk/*"
            element={<ProtectedRoute allow={['front_desk']}><div>Front desk area</div></ProtectedRoute>}
          />
          <Route path="/" element={<div>Clinic Triage System</div>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
```

Note: `App.test.tsx` from Task 1.1 still passes since `/` still renders text containing "Clinic".

- [ ] **Step 9: Run full web test suite**

Run: `npm run test -w apps/web`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/features/auth apps/web/src/App.tsx
git commit -m "feat: add auth provider, login/signup, and role-based routing"
```

---

## Milestone 2: AI Backend Service

Produces: a deployable Express service with two working, tested endpoints (triage classification, visit-note summarization) backed by Gemini, with the emergency safety rule and graceful-failure behavior in place.

### Task 2.1: Gemini client wrapper

**Files:**
- Create: `apps/ai-backend/src/gemini/client.ts`
- Test: `apps/ai-backend/src/gemini/client.test.ts`

**Interfaces:**
- Produces: `callGemini(prompt: string, schema: object): Promise<Record<string, unknown>>` — throws `GeminiUnavailableError` on failure/timeout

- [ ] **Step 1: Write failing test for the wrapper's error handling**

```ts
// apps/ai-backend/src/gemini/client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { callGemini, GeminiUnavailableError } from './client'

describe('callGemini', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns parsed JSON on success', async () => {
    ;(fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"urgency":"routine"}' }] } }],
      }),
    })
    const result = await callGemini('some prompt', {})
    expect(result).toEqual({ urgency: 'routine' })
  })

  it('throws GeminiUnavailableError on non-ok response', async () => {
    ;(fetch as any).mockResolvedValue({ ok: false, status: 503 })
    await expect(callGemini('some prompt', {})).rejects.toBeInstanceOf(GeminiUnavailableError)
  })

  it('throws GeminiUnavailableError on network failure', async () => {
    ;(fetch as any).mockRejectedValue(new Error('network down'))
    await expect(callGemini('some prompt', {})).rejects.toBeInstanceOf(GeminiUnavailableError)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -w apps/ai-backend`
Expected: FAIL — `./client` does not exist

- [ ] **Step 3: Implement the wrapper**

```ts
// apps/ai-backend/src/gemini/client.ts
export class GeminiUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GeminiUnavailableError'
  }
}

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

export async function callGemini(prompt: string, _schema: object): Promise<Record<string, unknown>> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new GeminiUnavailableError('GEMINI_API_KEY is not configured')

  let response: Response
  try {
    response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    throw new GeminiUnavailableError(`Gemini request failed: ${(err as Error).message}`)
  }

  if (!response.ok) {
    throw new GeminiUnavailableError(`Gemini returned status ${response.status}`)
  }

  const body = await response.json()
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new GeminiUnavailableError('Gemini response had no content')

  try {
    return JSON.parse(text)
  } catch {
    throw new GeminiUnavailableError('Gemini response was not valid JSON')
  }
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -w apps/ai-backend`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/ai-backend/src/gemini
git commit -m "feat: add Gemini client wrapper with graceful failure handling"
```

### Task 2.2: Triage endpoint with emergency safety rule

**Files:**
- Create: `apps/ai-backend/src/routes/triage.ts`
- Modify: `apps/ai-backend/src/server.ts`
- Test: `apps/ai-backend/src/routes/triage.test.ts`

**Interfaces:**
- Consumes: `callGemini` from `apps/ai-backend/src/gemini/client.ts` (Task 2.1)
- Produces: `POST /triage` accepting `{ symptomText: string, durationDays: number, bodyArea: string, severity: number }`, returning `{ urgency: 'routine'|'soon'|'urgent'|'emergency', suggestedDepartment: string, disclaimer: string }` (or a safe fallback on Gemini failure)

- [ ] **Step 1: Write failing tests, including the emergency and failure-fallback cases (Review Focus)**

```ts
// apps/ai-backend/src/routes/triage.test.ts
import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import * as geminiClient from '../gemini/client'

describe('POST /triage', () => {
  it('returns a structured urgency classification', async () => {
    vi.spyOn(geminiClient, 'callGemini').mockResolvedValue({
      urgency: 'soon', suggestedDepartment: 'General Practice',
    })
    const res = await request(app).post('/triage').send({
      symptomText: 'mild headache for 2 days', durationDays: 2, bodyArea: 'head', severity: 3,
    })
    expect(res.status).toBe(200)
    expect(res.body.urgency).toBe('soon')
    expect(res.body.disclaimer).toMatch(/not a diagnosis/i)
  })

  it('marks emergency urgency clearly so the UI can short-circuit', async () => {
    vi.spyOn(geminiClient, 'callGemini').mockResolvedValue({
      urgency: 'emergency', suggestedDepartment: 'Emergency',
    })
    const res = await request(app).post('/triage').send({
      symptomText: 'crushing chest pain radiating to left arm', durationDays: 0, bodyArea: 'chest', severity: 10,
    })
    expect(res.status).toBe(200)
    expect(res.body.urgency).toBe('emergency')
  })

  it('returns a safe fallback when Gemini is unavailable', async () => {
    vi.spyOn(geminiClient, 'callGemini').mockRejectedValue(
      new geminiClient.GeminiUnavailableError('down')
    )
    const res = await request(app).post('/triage').send({
      symptomText: 'sore throat', durationDays: 1, bodyArea: 'throat', severity: 2,
    })
    expect(res.status).toBe(200)
    expect(res.body.urgency).toBe('unknown')
    expect(res.body.disclaimer).toMatch(/call the clinic/i)
  })

  it('rejects requests missing required fields', async () => {
    const res = await request(app).post('/triage').send({ symptomText: '' })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm run test -w apps/ai-backend`
Expected: FAIL — route not mounted yet

- [ ] **Step 3: Implement the route**

```ts
// apps/ai-backend/src/routes/triage.ts
import { Router } from 'express'
import { callGemini, GeminiUnavailableError } from '../gemini/client'

export const triageRouter = Router()

const DISCLAIMER =
  'This is not a diagnosis. It is a general guide to help route you to the right care.'

triageRouter.post('/triage', async (req, res) => {
  const { symptomText, durationDays, bodyArea, severity } = req.body ?? {}
  if (!symptomText || typeof severity !== 'number' || !bodyArea) {
    return res.status(400).json({ error: 'symptomText, bodyArea, and severity are required' })
  }

  const prompt = `You are a clinical triage assistant. Given the patient's reported symptoms,
respond with strict JSON: {"urgency": "routine"|"soon"|"urgent"|"emergency", "suggestedDepartment": string}.
Use "emergency" only for symptoms that could be life-threatening (e.g. chest pain, difficulty breathing,
severe bleeding, stroke signs). Symptoms: "${symptomText}". Body area: ${bodyArea}. Duration (days): ${durationDays}.
Self-reported severity (1-10): ${severity}.`

  try {
    const result = await callGemini(prompt, {})
    return res.json({
      urgency: result.urgency,
      suggestedDepartment: result.suggestedDepartment,
      disclaimer: DISCLAIMER,
    })
  } catch (err) {
    if (err instanceof GeminiUnavailableError) {
      return res.json({
        urgency: 'unknown',
        suggestedDepartment: null,
        disclaimer:
          'We could not automatically assess your symptoms right now. Please call the clinic directly, or call emergency services if this is urgent.',
      })
    }
    throw err
  }
})
```

- [ ] **Step 4: Mount the router in `server.ts`**

```ts
// apps/ai-backend/src/server.ts (modify)
import express from 'express'
import { triageRouter } from './routes/triage'

export const app = express()
app.use(express.json())
app.use(triageRouter)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

if (require.main === module) {
  const port = process.env.PORT ?? 4000
  app.listen(port, () => console.log(`AI backend listening on ${port}`))
}
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `npm run test -w apps/ai-backend`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/ai-backend/src/routes/triage.ts apps/ai-backend/src/server.ts
git commit -m "feat: add /triage endpoint with emergency handling and safe fallback"
```

### Task 2.3: Visit-note summarization endpoint

**Files:**
- Create: `apps/ai-backend/src/routes/summarize.ts`
- Modify: `apps/ai-backend/src/server.ts`
- Test: `apps/ai-backend/src/routes/summarize.test.ts`

**Interfaces:**
- Consumes: `callGemini` from `apps/ai-backend/src/gemini/client.ts` (Task 2.1)
- Produces: `POST /summarize-visit` accepting `{ rawNotes: string }`, returning `{ clinicalSummary: string, patientSummary: string }`

- [ ] **Step 1: Write failing test**

```ts
// apps/ai-backend/src/routes/summarize.test.ts
import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import * as geminiClient from '../gemini/client'

describe('POST /summarize-visit', () => {
  it('returns clinical and patient-facing summaries', async () => {
    vi.spyOn(geminiClient, 'callGemini').mockResolvedValue({
      clinicalSummary: 'Pt presents with URI symptoms, afebrile, prescribed rest and fluids.',
      patientSummary: 'You have a mild upper respiratory infection. Rest, drink fluids, follow up if worse.',
    })
    const res = await request(app).post('/summarize-visit').send({
      rawNotes: 'pt c/o cough, congestion x3d, no fever, lungs clear, dx viral URI, rest+fluids',
    })
    expect(res.status).toBe(200)
    expect(res.body.clinicalSummary).toContain('URI')
    expect(res.body.patientSummary).toMatch(/respiratory infection/)
  })

  it('rejects empty notes', async () => {
    const res = await request(app).post('/summarize-visit').send({ rawNotes: '' })
    expect(res.status).toBe(400)
  })

  it('returns 502 when Gemini is unavailable', async () => {
    vi.spyOn(geminiClient, 'callGemini').mockRejectedValue(
      new geminiClient.GeminiUnavailableError('down')
    )
    const res = await request(app).post('/summarize-visit').send({ rawNotes: 'some notes' })
    expect(res.status).toBe(502)
  })
})
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm run test -w apps/ai-backend`
Expected: FAIL — route not mounted yet

- [ ] **Step 3: Implement the route**

```ts
// apps/ai-backend/src/routes/summarize.ts
import { Router } from 'express'
import { callGemini, GeminiUnavailableError } from '../gemini/client'

export const summarizeRouter = Router()

summarizeRouter.post('/summarize-visit', async (req, res) => {
  const { rawNotes } = req.body ?? {}
  if (!rawNotes || typeof rawNotes !== 'string') {
    return res.status(400).json({ error: 'rawNotes is required' })
  }

  const prompt = `You are a clinical scribe assistant. Given a doctor's raw visit notes, respond with
strict JSON: {"clinicalSummary": string, "patientSummary": string}. clinicalSummary is a concise
structured note for the medical record. patientSummary is a plain-language explanation for the patient,
written at an 8th-grade reading level, including any follow-up instructions. Raw notes: "${rawNotes}"`

  try {
    const result = await callGemini(prompt, {})
    return res.json({
      clinicalSummary: result.clinicalSummary,
      patientSummary: result.patientSummary,
    })
  } catch (err) {
    if (err instanceof GeminiUnavailableError) {
      return res.status(502).json({ error: 'AI summarization is temporarily unavailable' })
    }
    throw err
  }
})
```

- [ ] **Step 4: Mount the router in `server.ts`**

```ts
// apps/ai-backend/src/server.ts (modify)
import { summarizeRouter } from './routes/summarize'
// ...
app.use(triageRouter)
app.use(summarizeRouter)
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `npm run test -w apps/ai-backend`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/ai-backend/src/routes/summarize.ts apps/ai-backend/src/server.ts
git commit -m "feat: add /summarize-visit endpoint"
```

---

## Milestone 3: Patient Flow

Produces: the full patient journey — AI symptom triage (with the emergency bypass wired end-to-end), booking, reschedule/cancel, and visit history with AI summaries.

### Task 3.1: Symptom triage form with emergency bypass

**Files:**
- Create: `apps/web/src/features/patient/TriageForm.tsx`
- Create: `apps/web/src/features/patient/aiBackendClient.ts`
- Test: `apps/web/src/features/patient/TriageForm.test.tsx`

**Interfaces:**
- Consumes: `POST /triage` from AI backend (Task 2.2)
- Produces: `submitTriage(input): Promise<TriageResult>` in `aiBackendClient.ts`; `<TriageForm onComplete={(result) => void}>`

- [ ] **Step 1: Write failing test for the emergency short-circuit (Review Focus)**

```tsx
// apps/web/src/features/patient/TriageForm.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TriageForm } from './TriageForm'
import * as client from './aiBackendClient'

describe('TriageForm', () => {
  it('shows an emergency banner immediately, before any booking UI, when urgency is emergency', async () => {
    vi.spyOn(client, 'submitTriage').mockResolvedValue({
      urgency: 'emergency', suggestedDepartment: 'Emergency', disclaimer: 'not a diagnosis',
    })
    render(<TriageForm onComplete={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/describe your symptoms/i), { target: { value: 'chest pain' } })
    fireEvent.change(screen.getByLabelText(/severity/i), { target: { value: '10' } })
    fireEvent.click(screen.getByText(/submit/i))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/call emergency services/i)
    })
    expect(screen.queryByText(/book appointment/i)).not.toBeInTheDocument()
  })

  it('calls onComplete with the result for non-emergency urgency', async () => {
    const onComplete = vi.fn()
    vi.spyOn(client, 'submitTriage').mockResolvedValue({
      urgency: 'routine', suggestedDepartment: 'General Practice', disclaimer: 'not a diagnosis',
    })
    render(<TriageForm onComplete={onComplete} />)
    fireEvent.change(screen.getByLabelText(/describe your symptoms/i), { target: { value: 'mild cough' } })
    fireEvent.change(screen.getByLabelText(/severity/i), { target: { value: '2' } })
    fireEvent.click(screen.getByText(/submit/i))

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ urgency: 'routine' })
    ))
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -w apps/web`
Expected: FAIL — `TriageForm` and `aiBackendClient` do not exist

- [ ] **Step 3: Implement `aiBackendClient`**

```ts
// apps/web/src/features/patient/aiBackendClient.ts
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
}

const AI_BACKEND_URL = import.meta.env.VITE_AI_BACKEND_URL

export async function submitTriage(input: TriageInput): Promise<TriageResult> {
  const res = await fetch(`${AI_BACKEND_URL}/triage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Triage request failed')
  return res.json()
}
```

- [ ] **Step 4: Implement `TriageForm`**

```tsx
// apps/web/src/features/patient/TriageForm.tsx
import { useState, type FormEvent } from 'react'
import { submitTriage, type TriageResult } from './aiBackendClient'

export function TriageForm({ onComplete }: { onComplete: (result: TriageResult) => void }) {
  const [symptomText, setSymptomText] = useState('')
  const [bodyArea, setBodyArea] = useState('')
  const [durationDays, setDurationDays] = useState(1)
  const [severity, setSeverity] = useState(1)
  const [emergency, setEmergency] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const result = await submitTriage({ symptomText, bodyArea, durationDays, severity })
    setSubmitting(false)
    if (result.urgency === 'emergency') {
      setEmergency(true)
      return
    }
    onComplete(result)
  }

  if (emergency) {
    return (
      <p role="alert">
        Your symptoms may be a medical emergency. Please call emergency services (911) or go to
        the nearest emergency room immediately. Do not wait for an appointment.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Describe your symptoms
        <textarea
          aria-label="Describe your symptoms"
          value={symptomText}
          onChange={(e) => setSymptomText(e.target.value)}
          required
        />
      </label>
      <label>
        Body area
        <input aria-label="Body area" value={bodyArea} onChange={(e) => setBodyArea(e.target.value)} required />
      </label>
      <label>
        Duration (days)
        <input
          aria-label="Duration (days)" type="number" min={0}
          value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))}
        />
      </label>
      <label>
        Severity (1-10)
        <input
          aria-label="Severity" type="number" min={1} max={10}
          value={severity} onChange={(e) => setSeverity(Number(e.target.value))}
        />
      </label>
      <button type="submit" disabled={submitting}>Submit</button>
    </form>
  )
}
```

- [ ] **Step 5: Run test, verify it passes**

Run: `npm run test -w apps/web`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/patient/TriageForm.tsx apps/web/src/features/patient/aiBackendClient.ts
git commit -m "feat: add patient symptom triage form with emergency bypass"
```

### Task 3.2: Booking flow with double-booking prevention

**Files:**
- Create: `apps/web/src/features/patient/BookingForm.tsx`
- Create: `apps/web/src/features/patient/appointmentsApi.ts`
- Test: `apps/web/src/features/patient/BookingForm.test.tsx`

**Interfaces:**
- Consumes: `supabase` client (Task 1.2), `appointments` table `unique (doctor_id, scheduled_at)` constraint (Task 1.2)
- Produces: `bookAppointment(input): Promise<{ ok: true, appointmentId: string } | { ok: false, error: 'slot_taken' | 'unknown' }>`

- [ ] **Step 1: Write failing test covering the double-booking case (Review Focus)**

```tsx
// apps/web/src/features/patient/BookingForm.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BookingForm } from './BookingForm'
import * as api from './appointmentsApi'

describe('BookingForm', () => {
  it('shows a clear message when the slot was just taken by someone else', async () => {
    vi.spyOn(api, 'bookAppointment').mockResolvedValue({ ok: false, error: 'slot_taken' })
    render(<BookingForm doctorId="doc-1" patientId="pat-1" scheduledAt="2026-10-01T09:00:00Z" />)
    fireEvent.click(screen.getByText(/confirm booking/i))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/no longer available/i)
    })
  })

  it('confirms booking on success', async () => {
    vi.spyOn(api, 'bookAppointment').mockResolvedValue({ ok: true, appointmentId: 'appt-1' })
    render(<BookingForm doctorId="doc-1" patientId="pat-1" scheduledAt="2026-10-01T09:00:00Z" />)
    fireEvent.click(screen.getByText(/confirm booking/i))
    await waitFor(() => {
      expect(screen.getByText(/appointment booked/i)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -w apps/web`
Expected: FAIL — `BookingForm` and `appointmentsApi` do not exist

- [ ] **Step 3: Implement `appointmentsApi`**

```ts
// apps/web/src/features/patient/appointmentsApi.ts
import { supabase } from '../../lib/supabaseClient'

export type BookResult =
  | { ok: true; appointmentId: string }
  | { ok: false; error: 'slot_taken' | 'unknown' }

export async function bookAppointment(input: {
  doctorId: string
  patientId: string
  scheduledAt: string
}): Promise<BookResult> {
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      doctor_id: input.doctorId,
      patient_id: input.patientId,
      scheduled_at: input.scheduledAt,
      source: 'self_booked',
    })
    .select('id')
    .single()

  if (error) {
    // Postgres unique_violation code from the (doctor_id, scheduled_at) constraint
    if (error.code === '23505') return { ok: false, error: 'slot_taken' }
    return { ok: false, error: 'unknown' }
  }
  return { ok: true, appointmentId: data.id }
}
```

- [ ] **Step 4: Implement `BookingForm`**

```tsx
// apps/web/src/features/patient/BookingForm.tsx
import { useState } from 'react'
import { bookAppointment } from './appointmentsApi'

export function BookingForm({
  doctorId, patientId, scheduledAt,
}: { doctorId: string; patientId: string; scheduledAt: string }) {
  const [status, setStatus] = useState<'idle' | 'booked' | 'slot_taken' | 'error'>('idle')

  async function handleConfirm() {
    const result = await bookAppointment({ doctorId, patientId, scheduledAt })
    if (result.ok) setStatus('booked')
    else if (result.error === 'slot_taken') setStatus('slot_taken')
    else setStatus('error')
  }

  if (status === 'booked') return <p>Appointment booked for {new Date(scheduledAt).toLocaleString()}.</p>
  if (status === 'slot_taken') {
    return <p role="alert">Sorry, this time slot is no longer available. Please pick another.</p>
  }

  return (
    <div>
      <p>Confirm appointment on {new Date(scheduledAt).toLocaleString()}?</p>
      <button onClick={handleConfirm}>Confirm booking</button>
      {status === 'error' && <p role="alert">Something went wrong. Please try again.</p>}
    </div>
  )
}
```

- [ ] **Step 5: Run test, verify it passes**

Run: `npm run test -w apps/web`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/patient/BookingForm.tsx apps/web/src/features/patient/appointmentsApi.ts
git commit -m "feat: add patient booking flow with slot-taken handling"
```

### Task 3.3: Reschedule & cancel

**Files:**
- Create: `apps/web/src/features/patient/AppointmentActions.tsx`
- Modify: `apps/web/src/features/patient/appointmentsApi.ts`
- Test: `apps/web/src/features/patient/AppointmentActions.test.tsx`

**Interfaces:**
- Consumes: `appointmentsApi` (Task 3.2)
- Produces: `rescheduleAppointment(id, newTime): Promise<BookResult>`, `cancelAppointment(id): Promise<{ ok: boolean }>`; `<AppointmentActions appointment={...} />`

- [ ] **Step 1: Write failing tests**

```tsx
// apps/web/src/features/patient/AppointmentActions.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AppointmentActions } from './AppointmentActions'
import * as api from './appointmentsApi'

describe('AppointmentActions', () => {
  it('cancels an appointment', async () => {
    vi.spyOn(api, 'cancelAppointment').mockResolvedValue({ ok: true })
    render(<AppointmentActions appointment={{ id: 'appt-1', scheduledAt: '2026-10-01T09:00:00Z' }} />)
    fireEvent.click(screen.getByText(/cancel/i))
    await waitFor(() => expect(screen.getByText(/cancelled/i)).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -w apps/web`
Expected: FAIL — `AppointmentActions` does not exist, `cancelAppointment` not exported

- [ ] **Step 3: Add reschedule/cancel functions to `appointmentsApi.ts`**

```ts
// apps/web/src/features/patient/appointmentsApi.ts (append)
export async function rescheduleAppointment(id: string, newTime: string): Promise<BookResult> {
  const { error } = await supabase.from('appointments').update({ scheduled_at: newTime }).eq('id', id)
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'slot_taken' }
    return { ok: false, error: 'unknown' }
  }
  return { ok: true, appointmentId: id }
}

export async function cancelAppointment(id: string): Promise<{ ok: boolean }> {
  const { error } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id)
  return { ok: !error }
}
```

- [ ] **Step 4: Implement `AppointmentActions`**

```tsx
// apps/web/src/features/patient/AppointmentActions.tsx
import { useState } from 'react'
import { cancelAppointment } from './appointmentsApi'

export function AppointmentActions({ appointment }: { appointment: { id: string; scheduledAt: string } }) {
  const [cancelled, setCancelled] = useState(false)

  async function handleCancel() {
    const result = await cancelAppointment(appointment.id)
    if (result.ok) setCancelled(true)
  }

  if (cancelled) return <p>Appointment cancelled.</p>

  return <button onClick={handleCancel}>Cancel</button>
}
```

- [ ] **Step 5: Run test, verify it passes**

Run: `npm run test -w apps/web`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/patient/AppointmentActions.tsx apps/web/src/features/patient/appointmentsApi.ts
git commit -m "feat: add appointment reschedule and cancel"
```

### Task 3.4: Visit history with AI summaries

**Files:**
- Create: `apps/web/src/features/patient/VisitHistory.tsx`
- Test: `apps/web/src/features/patient/VisitHistory.test.tsx`

**Interfaces:**
- Consumes: `supabase` client, `visit_notes.ai_patient_summary` (RLS policy `visit_notes_patient_read` from Task 1.2)

- [ ] **Step 1: Write failing test**

```tsx
// apps/web/src/features/patient/VisitHistory.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { VisitHistory } from './VisitHistory'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

describe('VisitHistory', () => {
  it('renders past visits with their patient-facing AI summary', async () => {
    ;(supabase.from as any).mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({
            data: [{ appointment_id: 'a1', scheduled_at: '2026-09-01T09:00:00Z', ai_patient_summary: 'You had a mild cold.' }],
            error: null,
          }),
        }),
      }),
    })
    render(<VisitHistory patientId="pat-1" />)
    await waitFor(() => expect(screen.getByText(/mild cold/i)).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -w apps/web`
Expected: FAIL — `VisitHistory` does not exist

- [ ] **Step 3: Implement `VisitHistory`**

```tsx
// apps/web/src/features/patient/VisitHistory.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

interface Visit {
  appointment_id: string
  scheduled_at: string
  ai_patient_summary: string | null
}

export function VisitHistory({ patientId }: { patientId: string }) {
  const [visits, setVisits] = useState<Visit[]>([])

  useEffect(() => {
    supabase
      .from('appointments')
      .select('id, scheduled_at, visit_notes(ai_patient_summary)')
      .eq('patient_id', patientId)
      .order('scheduled_at', { ascending: false })
      .then(({ data }) => {
        if (data) {
          setVisits(
            data.map((row: any) => ({
              appointment_id: row.id,
              scheduled_at: row.scheduled_at,
              ai_patient_summary: row.visit_notes?.ai_patient_summary ?? null,
            }))
          )
        }
      })
  }, [patientId])

  return (
    <ul>
      {visits.map((v) => (
        <li key={v.appointment_id}>
          <p>{new Date(v.scheduled_at).toLocaleDateString()}</p>
          {v.ai_patient_summary && <p>{v.ai_patient_summary}</p>}
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -w apps/web`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/patient/VisitHistory.tsx
git commit -m "feat: add patient visit history with AI summaries"
```

---

## Milestone 4: Doctor Flow

Produces: the doctor's daily queue (sorted by urgency), patient chart access, AI-assisted note-taking, and availability management.

### Task 4.1: Daily queue view sorted by urgency

**Files:**
- Create: `apps/web/src/features/doctor/DailyQueue.tsx`
- Test: `apps/web/src/features/doctor/DailyQueue.test.tsx`

**Interfaces:**
- Consumes: `supabase` client, `appointments` + `triage_submissions` (Task 1.2)

- [ ] **Step 1: Write failing test asserting urgent patients sort first**

```tsx
// apps/web/src/features/doctor/DailyQueue.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DailyQueue } from './DailyQueue'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }))

describe('DailyQueue', () => {
  it('lists urgent patients before routine ones', async () => {
    ;(supabase.from as any).mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({
            data: [
              { id: 'a1', scheduled_at: '2026-09-28T09:00:00Z', urgency_level: 'routine', patients: { profiles: { full_name: 'Alice' } } },
              { id: 'a2', scheduled_at: '2026-09-28T09:30:00Z', urgency_level: 'urgent', patients: { profiles: { full_name: 'Bob' } } },
            ],
            error: null,
          }),
        }),
      }),
    })
    render(<DailyQueue doctorId="doc-1" date="2026-09-28" />)
    await waitFor(() => {
      const names = screen.getAllByTestId('patient-name').map((n) => n.textContent)
      expect(names).toEqual(['Bob', 'Alice'])
    })
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -w apps/web`
Expected: FAIL — `DailyQueue` does not exist

- [ ] **Step 3: Implement `DailyQueue`**

```tsx
// apps/web/src/features/doctor/DailyQueue.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const URGENCY_ORDER: Record<string, number> = { emergency: 0, urgent: 1, soon: 2, routine: 3 }

interface QueueItem {
  id: string
  scheduled_at: string
  urgency_level: string | null
  patientName: string
}

export function DailyQueue({ doctorId, date }: { doctorId: string; date: string }) {
  const [items, setItems] = useState<QueueItem[]>([])

  useEffect(() => {
    supabase
      .from('appointments')
      .select('id, scheduled_at, urgency_level, patients(profiles(full_name))')
      .eq('doctor_id', doctorId)
      .order('scheduled_at', { ascending: true })
      .then(({ data }) => {
        if (!data) return
        const sorted = [...data].sort(
          (a: any, b: any) =>
            (URGENCY_ORDER[a.urgency_level ?? 'routine'] ?? 3) -
            (URGENCY_ORDER[b.urgency_level ?? 'routine'] ?? 3)
        )
        setItems(
          sorted.map((row: any) => ({
            id: row.id,
            scheduled_at: row.scheduled_at,
            urgency_level: row.urgency_level,
            patientName: row.patients.profiles.full_name,
          }))
        )
      })
  }, [doctorId, date])

  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          <span data-testid="patient-name">{item.patientName}</span>
          <span>{item.urgency_level ?? 'routine'}</span>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -w apps/web`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/doctor/DailyQueue.tsx
git commit -m "feat: add doctor daily queue sorted by triage urgency"
```

### Task 4.2: Patient chart view

**Files:**
- Create: `apps/web/src/features/doctor/PatientChart.tsx`
- Test: `apps/web/src/features/doctor/PatientChart.test.tsx`

**Interfaces:**
- Consumes: `supabase` client, `patients`, `triage_submissions`, `visit_notes` (doctor read policies from Task 1.2)

- [ ] **Step 1: Write failing test**

```tsx
// apps/web/src/features/doctor/PatientChart.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PatientChart } from './PatientChart'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }))

describe('PatientChart', () => {
  it('shows the patient name and most recent triage note', async () => {
    ;(supabase.from as any).mockImplementation((table: string) => {
      if (table === 'patients') {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { profiles: { full_name: 'Alice' } }, error: null }) }) }) }
      }
      return {
        select: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [{ symptom_text: 'headache' }], error: null }) }) }) }),
      }
    })
    render(<PatientChart patientId="pat-1" />)
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText(/headache/)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -w apps/web`
Expected: FAIL — `PatientChart` does not exist

- [ ] **Step 3: Implement `PatientChart`**

```tsx
// apps/web/src/features/doctor/PatientChart.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export function PatientChart({ patientId }: { patientId: string }) {
  const [name, setName] = useState('')
  const [latestSymptom, setLatestSymptom] = useState('')

  useEffect(() => {
    supabase
      .from('patients')
      .select('profiles(full_name)')
      .eq('profile_id', patientId)
      .single()
      .then(({ data }: any) => setName(data?.profiles?.full_name ?? ''))

    supabase
      .from('triage_submissions')
      .select('symptom_text')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }: any) => setLatestSymptom(data?.[0]?.symptom_text ?? ''))
  }, [patientId])

  return (
    <div>
      <h2>{name}</h2>
      {latestSymptom && <p>Latest reported symptoms: {latestSymptom}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -w apps/web`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/doctor/PatientChart.tsx
git commit -m "feat: add doctor patient chart view"
```

### Task 4.3: AI-assisted visit notes

**Files:**
- Create: `apps/web/src/features/doctor/VisitNoteEditor.tsx`
- Create: `apps/web/src/features/doctor/visitNotesApi.ts`
- Test: `apps/web/src/features/doctor/VisitNoteEditor.test.tsx`

**Interfaces:**
- Consumes: `POST /summarize-visit` (Task 2.3), `supabase` client (`visit_notes` doctor-write policy, Task 1.2)

- [ ] **Step 1: Write failing test**

```tsx
// apps/web/src/features/doctor/VisitNoteEditor.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { VisitNoteEditor } from './VisitNoteEditor'
import * as api from './visitNotesApi'

describe('VisitNoteEditor', () => {
  it('summarizes and saves notes on submit', async () => {
    const saveSpy = vi.spyOn(api, 'saveVisitNote').mockResolvedValue({ ok: true })
    vi.spyOn(api, 'summarizeNotes').mockResolvedValue({
      clinicalSummary: 'URI, rest advised', patientSummary: 'You have a cold, rest and drink fluids.',
    })
    render(<VisitNoteEditor appointmentId="appt-1" />)
    fireEvent.change(screen.getByLabelText(/raw notes/i), { target: { value: 'cough, congestion, viral URI' } })
    fireEvent.click(screen.getByText(/save/i))

    await waitFor(() => {
      expect(screen.getByText(/cold, rest and drink fluids/)).toBeInTheDocument()
    })
    expect(saveSpy).toHaveBeenCalledWith('appt-1', expect.objectContaining({
      doctorRawNotes: 'cough, congestion, viral URI',
      aiClinicalSummary: 'URI, rest advised',
      aiPatientSummary: 'You have a cold, rest and drink fluids.',
    }))
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -w apps/web`
Expected: FAIL — `VisitNoteEditor` and `visitNotesApi` do not exist

- [ ] **Step 3: Implement `visitNotesApi`**

```ts
// apps/web/src/features/doctor/visitNotesApi.ts
import { supabase } from '../../lib/supabaseClient'

const AI_BACKEND_URL = import.meta.env.VITE_AI_BACKEND_URL

export async function summarizeNotes(rawNotes: string) {
  const res = await fetch(`${AI_BACKEND_URL}/summarize-visit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawNotes }),
  })
  if (!res.ok) throw new Error('Summarization failed')
  return res.json() as Promise<{ clinicalSummary: string; patientSummary: string }>
}

export async function saveVisitNote(
  appointmentId: string,
  data: { doctorRawNotes: string; aiClinicalSummary: string; aiPatientSummary: string }
): Promise<{ ok: boolean }> {
  const { error } = await supabase.from('visit_notes').upsert({
    appointment_id: appointmentId,
    doctor_raw_notes: data.doctorRawNotes,
    ai_structured_summary: data.aiClinicalSummary,
    ai_patient_summary: data.aiPatientSummary,
  })
  return { ok: !error }
}
```

- [ ] **Step 4: Implement `VisitNoteEditor`**

```tsx
// apps/web/src/features/doctor/VisitNoteEditor.tsx
import { useState } from 'react'
import { summarizeNotes, saveVisitNote } from './visitNotesApi'

export function VisitNoteEditor({ appointmentId }: { appointmentId: string }) {
  const [rawNotes, setRawNotes] = useState('')
  const [patientSummary, setPatientSummary] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const { clinicalSummary, patientSummary: ps } = await summarizeNotes(rawNotes)
    await saveVisitNote(appointmentId, {
      doctorRawNotes: rawNotes, aiClinicalSummary: clinicalSummary, aiPatientSummary: ps,
    })
    setPatientSummary(ps)
    setSaving(false)
  }

  return (
    <div>
      <label>
        Raw notes
        <textarea aria-label="Raw notes" value={rawNotes} onChange={(e) => setRawNotes(e.target.value)} />
      </label>
      <button onClick={handleSave} disabled={saving}>Save</button>
      {patientSummary && <p>Patient summary preview: {patientSummary}</p>}
    </div>
  )
}
```

- [ ] **Step 5: Run test, verify it passes**

Run: `npm run test -w apps/web`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/doctor/VisitNoteEditor.tsx apps/web/src/features/doctor/visitNotesApi.ts
git commit -m "feat: add AI-assisted visit note editor"
```

### Task 4.4: Manage availability

**Files:**
- Create: `apps/web/src/features/doctor/AvailabilityEditor.tsx`
- Test: `apps/web/src/features/doctor/AvailabilityEditor.test.tsx`

**Interfaces:**
- Consumes: `supabase` client, `doctors.working_hours` jsonb column (Task 1.2)

- [ ] **Step 1: Write failing test**

```tsx
// apps/web/src/features/doctor/AvailabilityEditor.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AvailabilityEditor } from './AvailabilityEditor'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }))

describe('AvailabilityEditor', () => {
  it('saves updated working hours', async () => {
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    ;(supabase.from as any).mockReturnValue({ update: () => ({ eq: updateEq }) })
    render(<AvailabilityEditor doctorId="doc-1" />)
    fireEvent.change(screen.getByLabelText(/monday start/i), { target: { value: '09:00' } })
    fireEvent.click(screen.getByText(/save availability/i))
    await waitFor(() => expect(updateEq).toHaveBeenCalledWith('doc-1'))
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -w apps/web`
Expected: FAIL — `AvailabilityEditor` does not exist

- [ ] **Step 3: Implement `AvailabilityEditor`**

```tsx
// apps/web/src/features/doctor/AvailabilityEditor.tsx
import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export function AvailabilityEditor({ doctorId }: { doctorId: string }) {
  const [mondayStart, setMondayStart] = useState('09:00')
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    const { error } = await supabase
      .from('doctors')
      .update({ working_hours: { monday: { start: mondayStart } } })
      .eq('profile_id', doctorId)
    setSaved(!error)
  }

  return (
    <div>
      <label>
        Monday start
        <input aria-label="Monday start" type="time" value={mondayStart} onChange={(e) => setMondayStart(e.target.value)} />
      </label>
      <button onClick={handleSave}>Save availability</button>
      {saved && <p>Availability saved.</p>}
    </div>
  )
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -w apps/web`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/doctor/AvailabilityEditor.tsx
git commit -m "feat: add doctor availability editor"
```

---

## Milestone 5: Front-Desk Flow

Produces: the master calendar, check-in/queue management, the no-show heuristic + dashboard, and patient record CRUD — respecting the RLS boundary that keeps clinical note content out of front-desk's reach.

### Task 5.1: Master calendar across all doctors

**Files:**
- Create: `apps/web/src/features/frontdesk/MasterCalendar.tsx`
- Test: `apps/web/src/features/frontdesk/MasterCalendar.test.tsx`

**Interfaces:**
- Consumes: `supabase` client, `appointments_front_desk` RLS policy (Task 1.2)

- [ ] **Step 1: Write failing test**

```tsx
// apps/web/src/features/frontdesk/MasterCalendar.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MasterCalendar } from './MasterCalendar'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }))

describe('MasterCalendar', () => {
  it('lists appointments across multiple doctors for the day', async () => {
    ;(supabase.from as any).mockReturnValue({
      select: () => ({
        gte: () => ({
          lte: () => Promise.resolve({
            data: [
              { id: 'a1', scheduled_at: '2026-09-28T09:00:00Z', doctors: { profiles: { full_name: 'Dr. Lee' } }, patients: { profiles: { full_name: 'Alice' } } },
              { id: 'a2', scheduled_at: '2026-09-28T10:00:00Z', doctors: { profiles: { full_name: 'Dr. Patel' } }, patients: { profiles: { full_name: 'Bob' } } },
            ],
            error: null,
          }),
        }),
      }),
    })
    render(<MasterCalendar date="2026-09-28" />)
    await waitFor(() => {
      expect(screen.getByText('Dr. Lee')).toBeInTheDocument()
      expect(screen.getByText('Dr. Patel')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -w apps/web`
Expected: FAIL — `MasterCalendar` does not exist

- [ ] **Step 3: Implement `MasterCalendar`**

```tsx
// apps/web/src/features/frontdesk/MasterCalendar.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

interface Row {
  id: string
  scheduled_at: string
  doctorName: string
  patientName: string
}

export function MasterCalendar({ date }: { date: string }) {
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    const dayStart = `${date}T00:00:00Z`
    const dayEnd = `${date}T23:59:59Z`
    supabase
      .from('appointments')
      .select('id, scheduled_at, doctors(profiles(full_name)), patients(profiles(full_name))')
      .gte('scheduled_at', dayStart)
      .lte('scheduled_at', dayEnd)
      .then(({ data }: any) => {
        if (!data) return
        setRows(
          data.map((r: any) => ({
            id: r.id,
            scheduled_at: r.scheduled_at,
            doctorName: r.doctors.profiles.full_name,
            patientName: r.patients.profiles.full_name,
          }))
        )
      })
  }, [date])

  return (
    <table>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>{new Date(r.scheduled_at).toLocaleTimeString()}</td>
            <td>{r.doctorName}</td>
            <td>{r.patientName}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -w apps/web`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/frontdesk/MasterCalendar.tsx
git commit -m "feat: add front-desk master calendar across all doctors"
```

### Task 5.2: Check-in & queue management

**Files:**
- Create: `apps/web/src/features/frontdesk/CheckIn.tsx`
- Test: `apps/web/src/features/frontdesk/CheckIn.test.tsx`

**Interfaces:**
- Consumes: `supabase` client, `appointments.status` (Task 1.2)

- [ ] **Step 1: Write failing test**

```tsx
// apps/web/src/features/frontdesk/CheckIn.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CheckIn } from './CheckIn'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }))

describe('CheckIn', () => {
  it('marks an appointment as checked in', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null })
    ;(supabase.from as any).mockReturnValue({ update: () => ({ eq: eqMock }) })
    render(<CheckIn appointmentId="a1" patientName="Alice" />)
    fireEvent.click(screen.getByText(/check in/i))
    await waitFor(() => expect(screen.getByText(/checked in/i)).toBeInTheDocument())
    expect(eqMock).toHaveBeenCalledWith('a1')
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -w apps/web`
Expected: FAIL — `CheckIn` does not exist

- [ ] **Step 3: Implement `CheckIn`**

```tsx
// apps/web/src/features/frontdesk/CheckIn.tsx
import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export function CheckIn({ appointmentId, patientName }: { appointmentId: string; patientName: string }) {
  const [checkedIn, setCheckedIn] = useState(false)

  async function handleCheckIn() {
    const { error } = await supabase.from('appointments').update({ status: 'checked_in' }).eq('id', appointmentId)
    if (!error) setCheckedIn(true)
  }

  return (
    <div>
      <span>{patientName}</span>
      {checkedIn ? <span>Checked in</span> : <button onClick={handleCheckIn}>Check in</button>}
    </div>
  )
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -w apps/web`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/frontdesk/CheckIn.tsx
git commit -m "feat: add front-desk patient check-in"
```

### Task 5.3: No-show heuristic scoring + dashboard

**Files:**
- Create: `apps/web/src/features/frontdesk/noShowHeuristic.ts`
- Create: `apps/web/src/features/frontdesk/NoShowDashboard.tsx`
- Test: `apps/web/src/features/frontdesk/noShowHeuristic.test.ts`

**Interfaces:**
- Produces: `computeNoShowRisk(input: NoShowInput): number` (pure function, 0–1) consumed by `NoShowDashboard`

- [ ] **Step 1: Write failing tests for the heuristic**

```ts
// apps/web/src/features/frontdesk/noShowHeuristic.test.ts
import { describe, it, expect } from 'vitest'
import { computeNoShowRisk } from './noShowHeuristic'

describe('computeNoShowRisk', () => {
  it('scores low risk for a front-desk-booked appointment with no history and short lead time', () => {
    const risk = computeNoShowRisk({
      leadTimeDays: 1, dayOfWeek: 2, pastNoShowCount: 0, source: 'front_desk',
    })
    expect(risk).toBeLessThan(0.3)
  })

  it('scores high risk for a patient with prior no-shows and a long lead time', () => {
    const risk = computeNoShowRisk({
      leadTimeDays: 30, dayOfWeek: 1, pastNoShowCount: 3, source: 'self_booked',
    })
    expect(risk).toBeGreaterThan(0.6)
  })

  it('always returns a value between 0 and 1', () => {
    const risk = computeNoShowRisk({ leadTimeDays: 365, dayOfWeek: 6, pastNoShowCount: 10, source: 'self_booked' })
    expect(risk).toBeGreaterThanOrEqual(0)
    expect(risk).toBeLessThanOrEqual(1)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -w apps/web`
Expected: FAIL — `noShowHeuristic` does not exist

- [ ] **Step 3: Implement the heuristic**

```ts
// apps/web/src/features/frontdesk/noShowHeuristic.ts
export interface NoShowInput {
  leadTimeDays: number
  dayOfWeek: number // 0 = Sunday
  pastNoShowCount: number
  source: 'self_booked' | 'front_desk'
}

export function computeNoShowRisk(input: NoShowInput): number {
  let score = 0.1

  score += Math.min(input.leadTimeDays / 30, 1) * 0.3
  score += Math.min(input.pastNoShowCount * 0.15, 0.5)
  if (input.dayOfWeek === 0 || input.dayOfWeek === 6) score += 0.1
  if (input.source === 'self_booked') score += 0.05

  return Math.max(0, Math.min(1, score))
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -w apps/web`
Expected: PASS

- [ ] **Step 5: Write failing test for the dashboard**

```tsx
// (append to a new file) apps/web/src/features/frontdesk/NoShowDashboard.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { NoShowDashboard } from './NoShowDashboard'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }))

describe('NoShowDashboard', () => {
  it('flags appointments above the risk threshold', async () => {
    ;(supabase.from as any).mockReturnValue({
      select: () => ({
        gte: () => ({
          lte: () => Promise.resolve({
            data: [{
              id: 'a1', scheduled_at: '2026-10-28T09:00:00Z', source: 'self_booked',
              patients: { profiles: { full_name: 'Alice' } }, past_no_show_count: 4,
            }],
            error: null,
          }),
        }),
      }),
    })
    render(<NoShowDashboard date="2026-09-28" />)
    await waitFor(() => expect(screen.getByText(/alice/i)).toBeInTheDocument())
    expect(screen.getByText(/high risk/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run test, verify it fails**

Run: `npm run test -w apps/web`
Expected: FAIL — `NoShowDashboard` does not exist

- [ ] **Step 7: Implement `NoShowDashboard`**

```tsx
// apps/web/src/features/frontdesk/NoShowDashboard.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { computeNoShowRisk } from './noShowHeuristic'

interface RiskRow {
  id: string
  patientName: string
  risk: number
}

const HIGH_RISK_THRESHOLD = 0.6

export function NoShowDashboard({ date }: { date: string }) {
  const [rows, setRows] = useState<RiskRow[]>([])

  useEffect(() => {
    const dayStart = `${date}T00:00:00Z`
    const dayEnd = `${date}T23:59:59Z`
    supabase
      .from('appointments')
      .select('id, scheduled_at, source, past_no_show_count, patients(profiles(full_name))')
      .gte('scheduled_at', dayStart)
      .lte('scheduled_at', dayEnd)
      .then(({ data }: any) => {
        if (!data) return
        const now = new Date(date)
        setRows(
          data.map((r: any) => {
            const scheduled = new Date(r.scheduled_at)
            const leadTimeDays = Math.max(0, (scheduled.getTime() - now.getTime()) / 86_400_000)
            const risk = computeNoShowRisk({
              leadTimeDays,
              dayOfWeek: scheduled.getUTCDay(),
              pastNoShowCount: r.past_no_show_count ?? 0,
              source: r.source,
            })
            return { id: r.id, patientName: r.patients.profiles.full_name, risk }
          })
        )
      })
  }, [date])

  return (
    <ul>
      {rows.map((r) => (
        <li key={r.id}>
          {r.patientName} — {r.risk >= HIGH_RISK_THRESHOLD ? 'High risk' : 'Normal risk'}
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 8: Run test, verify it passes**

Run: `npm run test -w apps/web`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/features/frontdesk/noShowHeuristic.ts apps/web/src/features/frontdesk/NoShowDashboard.tsx apps/web/src/features/frontdesk/NoShowDashboard.test.tsx
git commit -m "feat: add no-show heuristic and front-desk risk dashboard"
```

### Task 5.4: Patient record CRUD

**Files:**
- Create: `apps/web/src/features/frontdesk/PatientRecordForm.tsx`
- Test: `apps/web/src/features/frontdesk/PatientRecordForm.test.tsx`

**Interfaces:**
- Consumes: `supabase` client, `patients_staff_read`/`patients` RLS policies (Task 1.2)

- [ ] **Step 1: Write failing test**

```tsx
// apps/web/src/features/frontdesk/PatientRecordForm.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PatientRecordForm } from './PatientRecordForm'
import { supabase } from '../../lib/supabaseClient'

vi.mock('../../lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }))

describe('PatientRecordForm', () => {
  it('updates patient contact info', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null })
    ;(supabase.from as any).mockReturnValue({ update: () => ({ eq: eqMock }) })
    render(<PatientRecordForm patientId="pat-1" initialInsuranceInfo="" />)
    fireEvent.change(screen.getByLabelText(/insurance info/i), { target: { value: 'Acme Health' } })
    fireEvent.click(screen.getByText(/save/i))
    await waitFor(() => expect(screen.getByText(/saved/i)).toBeInTheDocument())
    expect(eqMock).toHaveBeenCalledWith('pat-1')
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -w apps/web`
Expected: FAIL — `PatientRecordForm` does not exist

- [ ] **Step 3: Implement `PatientRecordForm`**

```tsx
// apps/web/src/features/frontdesk/PatientRecordForm.tsx
import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export function PatientRecordForm({
  patientId, initialInsuranceInfo,
}: { patientId: string; initialInsuranceInfo: string }) {
  const [insuranceInfo, setInsuranceInfo] = useState(initialInsuranceInfo)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    const { error } = await supabase.from('patients').update({ insurance_info: insuranceInfo }).eq('profile_id', patientId)
    setSaved(!error)
  }

  return (
    <div>
      <label>
        Insurance info
        <input aria-label="Insurance info" value={insuranceInfo} onChange={(e) => setInsuranceInfo(e.target.value)} />
      </label>
      <button onClick={handleSave}>Save</button>
      {saved && <p>Saved.</p>}
    </div>
  )
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -w apps/web`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/frontdesk/PatientRecordForm.tsx
git commit -m "feat: add front-desk patient record editing"
```

---

## Milestone 6: Notifications & Deployment

Produces: working email notifications (confirmation + reminder) and free-tier deployment configuration for all three deployable pieces.

### Task 6.1: Email notifications

**Files:**
- Create: `apps/ai-backend/src/notifications/email.ts`
- Create: `apps/ai-backend/src/routes/notify.ts`
- Modify: `apps/ai-backend/src/server.ts`
- Test: `apps/ai-backend/src/notifications/email.test.ts`, `apps/ai-backend/src/routes/notify.test.ts`

**Interfaces:**
- Produces: `sendEmail(to: string, subject: string, body: string): Promise<{ ok: boolean }>`; `POST /notify/appointment-confirmation`, `POST /notify/appointment-reminder`

- [ ] **Step 1: Write failing test for the email sender**

```ts
// apps/ai-backend/src/notifications/email.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendEmail } from './email'

describe('sendEmail', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()))

  it('returns ok true on successful send', async () => {
    ;(fetch as any).mockResolvedValue({ ok: true })
    const result = await sendEmail('patient@example.com', 'Subject', 'Body')
    expect(result.ok).toBe(true)
  })

  it('returns ok false when the email provider fails', async () => {
    ;(fetch as any).mockResolvedValue({ ok: false, status: 500 })
    const result = await sendEmail('patient@example.com', 'Subject', 'Body')
    expect(result.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm run test -w apps/ai-backend`
Expected: FAIL — `./email` does not exist

- [ ] **Step 3: Implement `sendEmail` using Resend's HTTP API**

```ts
// apps/ai-backend/src/notifications/email.ts
export async function sendEmail(to: string, subject: string, body: string): Promise<{ ok: boolean }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.NOTIFICATION_FROM_EMAIL ?? 'clinic@example.com'
  if (!apiKey) return { ok: false }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text: body }),
    })
    return { ok: res.ok }
  } catch {
    return { ok: false }
  }
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm run test -w apps/ai-backend`
Expected: PASS

- [ ] **Step 5: Write failing test for the notify route**

```ts
// apps/ai-backend/src/routes/notify.test.ts
import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import * as email from '../notifications/email'

describe('POST /notify/appointment-confirmation', () => {
  it('sends a confirmation email', async () => {
    const spy = vi.spyOn(email, 'sendEmail').mockResolvedValue({ ok: true })
    const res = await request(app).post('/notify/appointment-confirmation').send({
      to: 'patient@example.com', scheduledAt: '2026-10-01T09:00:00Z', doctorName: 'Dr. Lee',
    })
    expect(res.status).toBe(200)
    expect(spy).toHaveBeenCalledWith(
      'patient@example.com', expect.stringMatching(/confirmed/i), expect.stringContaining('Dr. Lee')
    )
  })
})
```

- [ ] **Step 6: Run test, verify it fails**

Run: `npm run test -w apps/ai-backend`
Expected: FAIL — route not mounted yet

- [ ] **Step 7: Implement the notify route**

```ts
// apps/ai-backend/src/routes/notify.ts
import { Router } from 'express'
import { sendEmail } from '../notifications/email'

export const notifyRouter = Router()

notifyRouter.post('/notify/appointment-confirmation', async (req, res) => {
  const { to, scheduledAt, doctorName } = req.body ?? {}
  if (!to || !scheduledAt || !doctorName) return res.status(400).json({ error: 'missing fields' })
  const when = new Date(scheduledAt).toLocaleString()
  const result = await sendEmail(
    to, 'Your appointment is confirmed',
    `Your appointment with ${doctorName} is confirmed for ${when}.`
  )
  res.json(result)
})

notifyRouter.post('/notify/appointment-reminder', async (req, res) => {
  const { to, scheduledAt, doctorName } = req.body ?? {}
  if (!to || !scheduledAt || !doctorName) return res.status(400).json({ error: 'missing fields' })
  const when = new Date(scheduledAt).toLocaleString()
  const result = await sendEmail(
    to, 'Appointment reminder',
    `Reminder: you have an appointment with ${doctorName} at ${when}.`
  )
  res.json(result)
})
```

- [ ] **Step 8: Mount the router in `server.ts`**

```ts
// apps/ai-backend/src/server.ts (modify)
import { notifyRouter } from './routes/notify'
// ...
app.use(summarizeRouter)
app.use(notifyRouter)
```

- [ ] **Step 9: Run tests, verify they pass**

Run: `npm run test -w apps/ai-backend`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add apps/ai-backend/src/notifications apps/ai-backend/src/routes/notify.ts apps/ai-backend/src/server.ts
git commit -m "feat: add email confirmation and reminder notifications"
```

### Task 6.2: Free-tier deployment configuration

**Files:**
- Create: `apps/web/vercel.json`
- Create: `apps/ai-backend/render.yaml`
- Create: `apps/web/.env.example`
- Create: `apps/ai-backend/.env.example`
- Create: `docs/deployment.md`

**Interfaces:** none (configuration only)

- [ ] **Step 1: Add Vercel config for the web app**

```json
// apps/web/vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

- [ ] **Step 2: Add Render config for the AI backend**

```yaml
# apps/ai-backend/render.yaml
services:
  - type: web
    name: clinic-ai-backend
    env: node
    plan: free
    buildCommand: npm install && npm run build
    startCommand: node dist/server.js
    envVars:
      - key: GEMINI_API_KEY
        sync: false
      - key: RESEND_API_KEY
        sync: false
      - key: NOTIFICATION_FROM_EMAIL
        sync: false
```

- [ ] **Step 3: Document required environment variables**

```
# apps/web/.env.example
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_AI_BACKEND_URL=
```

```
# apps/ai-backend/.env.example
GEMINI_API_KEY=
RESEND_API_KEY=
NOTIFICATION_FROM_EMAIL=
PORT=4000
```

- [ ] **Step 4: Write `docs/deployment.md` with the deployment steps**

```markdown
# Deployment (free tier)

1. Create a Supabase project, run `npx supabase db push` to apply migrations from `supabase/migrations/`.
2. Copy the Supabase project URL and anon key into `apps/web/.env` (see `.env.example`).
3. Deploy `apps/web` to Vercel: import the repo, set root directory to `apps/web`, add the env vars from `.env.example` in the Vercel dashboard.
4. Deploy `apps/ai-backend` to Render using `render.yaml`: connect the repo, set root directory to `apps/ai-backend`, add `GEMINI_API_KEY` and `RESEND_API_KEY` as secret env vars in the Render dashboard.
5. Set `VITE_AI_BACKEND_URL` in Vercel to the Render service's public URL.
6. Verify: sign up a patient, submit a triage form, confirm booking, and check the doctor/front-desk views on the deployed URLs.
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/vercel.json apps/ai-backend/render.yaml apps/web/.env.example apps/ai-backend/.env.example docs/deployment.md
git commit -m "chore: add free-tier deployment configuration and docs"
```

---

## Final Verification

After all milestones are complete:

- [ ] Run `npm run test` at the repo root — all frontend and backend tests pass.
- [ ] Run `npx supabase test db` — all RLS/pgTAP tests pass, including the Review Focus cases (front-desk blocked from `visit_notes`, patient isolation, double-booking rejection).
- [ ] Manually walk the golden path locally: patient signs up → submits triage (non-emergency) → books an appointment → doctor sees it in their queue sorted by urgency → doctor writes notes and gets an AI summary → patient sees the visit summary in their history → front-desk sees the appointment on the master calendar and can check the patient in.
- [ ] Manually verify the emergency path: submit triage with clearly emergency symptoms and confirm the UI shows the emergency banner and never reaches the booking form.
- [ ] Deploy following `docs/deployment.md` and repeat the golden-path walk-through on the deployed URLs.
