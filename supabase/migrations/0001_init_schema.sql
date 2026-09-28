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
