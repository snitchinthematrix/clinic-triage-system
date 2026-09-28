# Clinic Appointment & Patient Triage System — Design

See `docs/intent.md` for the purpose, audience, constraints, and success
criteria this design serves.

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  React (Vite)     │────▶│  Supabase              │     │  AI Backend       │
│  Web App           │     │  - Postgres            │◀───▶│  (Node/Express)  │
│  (Patient/Doctor/   │────▶│  - Auth (roles)        │     │  - Gemini calls   │
│   Front-desk UI)    │     │  - Row-Level Security  │     │  - Triage logic   │
└─────────────────┘     │  - Storage (files)     │     │  - Note summary   │
                          └──────────────────────┘     │  - No-show heur.  │
   (future: mobile apps ── same Supabase SDK + same AI backend REST calls)
```

- **Supabase** is the source of truth: Postgres DB, authentication, and
  role-based access via Row-Level Security (RLS) policies.
- **AI backend**: a small standalone Node/Express (TypeScript) service whose
  only job is to receive a request (symptom text, visit notes, or scheduling
  data), call the Google Gemini API (free tier) with a constrained prompt,
  and return structured JSON. Keeps the Gemini API key server-side only,
  never shipped to the browser.
- Frontend talks directly to Supabase (via its JS client) for CRUD, and to
  the AI backend only for the AI features (triage, note summarization).
- Adding native mobile later = point mobile app at same Supabase project +
  same AI backend REST endpoints. No backend rework needed.

## Roles & Auth

Supabase Auth (email+password for v1) with a `role` column
(`patient` | `doctor` | `front_desk`) on a `profiles` table linked 1:1 to
`auth.users`. RLS policies enforce access per role at the database level:

- **patient**: read/write only their own rows (appointments, triage
  submissions, visit summaries).
- **doctor**: read patients/appointments assigned to them; write their own
  notes, availability, and visit summaries.
- **front_desk**: broad read/write across patients and appointments
  (scheduling/admin fields), but not clinical note content — a deliberate
  boundary so front-desk manages logistics without seeing clinical detail.

Front-desk and doctor accounts are provisioned by an admin seed process, not
public self-signup. Patients self-register.

## Data Model (high level)

- `profiles` — id, role, name, contact info, linked to `auth.users`
- `doctors` — profile_id, specialty, working_hours
- `patients` — profile_id, DOB, insurance/contact extras
- `appointments` — patient_id, doctor_id, scheduled_at, status
  (booked/checked-in/in-progress/done/cancelled/no-show), urgency_level,
  source (self-booked/front-desk)
- `triage_submissions` — patient_id, appointment_id (nullable until booked),
  symptom_text, ai_urgency, ai_suggested_department, ai_raw_response,
  created_at
- `visit_notes` — appointment_id, doctor_raw_notes, ai_structured_summary,
  ai_patient_summary
- `no_show_scores` — appointment_id, risk_score, computed_at
- `notifications` — recipient_id, type, channel, status, sent_at (designed
  to support SMS/push later; email only in v1)

## Feature Scope by Role (v1)

**Patient**
- Book/reschedule/cancel appointments
- AI symptom triage before booking (structured form, not open chat)
- View visit history & AI-generated plain-language visit summaries
- Email appointment reminders/notifications

**Doctor**
- Daily schedule/queue view (with triage urgency shown)
- Patient chart access (history, past triage notes, past visit summaries)
- AI-assisted visit notes (doctor types notes → AI drafts structured
  clinical summary + patient-friendly summary)
- Manage own availability (working hours, time off)

**Front-desk Admin**
- Master calendar across all doctors (book/reschedule/cancel/walk-ins)
- Patient check-in & queue management, reprioritizing via AI urgency flags
- No-show risk dashboard (heuristic-based, see below)
- Patient record management (create/edit profiles, contact/insurance info)

## AI Features Design

**1. Symptom triage (flagship)**
- Patient fills a short structured form (duration, body area, severity 1–10,
  free-text description) — not open-ended chat, for reliable input and
  easier-to-constrain AI reasoning.
- AI backend sends this to Gemini with a system prompt producing structured
  JSON: urgency classification (routine / soon / urgent / emergency), a
  suggested department/doctor type, and a mandatory not-a-diagnosis
  disclaimer.
- **Safety rule:** if urgency = emergency, the UI immediately shows
  "call emergency services" messaging before any booking flow — the AI
  never gates a genuine emergency behind normal scheduling.
- Result saved to `triage_submissions`, shown to the doctor on their queue
  view alongside the appointment.

**2. AI visit-note summarization**
- Doctor types free-text notes during/after a visit. On save, the AI
  backend sends raw notes (+ relevant patient history) to Gemini, returning
  a structured clinical summary (for the chart) and a plain-language
  after-visit summary (for the patient portal).

**3. No-show risk (heuristic, not AI, for v1)**
- Rules-based score from: appointment lead time, day of week, patient's
  past no-show count, self-booked vs front-desk-booked. Deterministic and
  explainable for front-desk staff to trust. Avoids burning shared Gemini
  free-tier quota and avoids hallucinated risk scores from sparse data.
  Revisit as a trained ML model or LLM-reasoned score once real appointment
  history exists (v1.5+).

## Notifications

- v1 channel: **email only** (Resend or Supabase's built-in email) — SMS/push
  cost money per message, deferred to v1.5. `notifications` table already
  supports adding channels later without rework.
- Triggers: booking/reschedule/cancel confirmation, 24h-before reminder, and
  a high-no-show-risk nudge to front-desk (not the patient).

## Deployment (all free tier)

- Frontend (React/Vite) → **Vercel**
- Supabase project → **Supabase** free tier (Postgres + Auth + Storage)
- AI backend (Node/Express) → **Render** free tier (persistent server,
  simpler for a long-lived Express app than serverless-only options)
- Secrets (Gemini API key, Supabase service key) live only in Render env
  vars — never shipped to the frontend bundle

## Phasing

**v1 (true MVP):** auth + 3 roles/RBAC, booking/reschedule/cancel, AI
symptom triage, doctor queue + chart view, AI visit-note summarization,
front-desk master calendar + check-in, patient record CRUD, email
reminders, heuristic no-show flag.

**v1.5 (fast follow):** SMS/push notifications, doctor self-service
availability management UI (v1 can seed via admin/DB directly), richer
analytics dashboards, real ML-based no-show model.
