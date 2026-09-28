-- supabase/tests/rls.test.sql
-- pgTAP regression tests for the RLS policies in 0002_rls_policies.sql and
-- 0003_auth_provisioning_and_read_policies.sql. Covers the plan's Review
-- Focus items plus positive controls and the C1 privilege-escalation fix
-- (added after a fresh-context code review found the negative-only
-- assertions below would pass even if RLS denied authenticated users
-- everything, not just the specific rows under test).

create extension if not exists pgtap with schema extensions;

begin;
select plan(7);

-- Fixtures: two patients, one doctor, one front_desk user, two appointments,
-- and one visit_note. Loaded as the superuser/owner role, which bypasses RLS.
\ir seed.pgsql

-- 1. patient A cannot select patient B's appointments.
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

select is_empty(
  $$ select * from appointments where patient_id = '22222222-2222-2222-2222-222222222222' $$,
  'patient A cannot read patient B appointments'
);

-- 1b. positive control: patient A CAN read their own appointment. Without
-- this, test 1 above would pass even if RLS denied authenticated users
-- every row, not just patient B's.
select isnt_empty(
  $$ select * from appointments where patient_id = '11111111-1111-1111-1111-111111111111' $$,
  'patient A can read their own appointment'
);

-- 1c. patient A cannot read patient B's triage submissions either.
select is_empty(
  $$ select * from triage_submissions where patient_id = '22222222-2222-2222-2222-222222222222' $$,
  'patient A cannot read patient B triage submissions'
);

-- 2. front_desk cannot select any row from visit_notes.
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);

select is_empty(
  $$ select * from visit_notes $$,
  'front_desk cannot read visit_notes at all'
);

-- 2b. positive control: doctor A CAN read the visit note for their own
-- appointment (proves visit_notes RLS isn't simply deny-all for everyone).
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);

select isnt_empty(
  $$ select * from visit_notes where appointment_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  'doctor A can read the visit note for their own appointment'
);

-- 2c. C1 regression: since profiles_self_insert was dropped (migration
-- 0003), a signed-up user's profiles row now only ever comes from the
-- on_auth_user_created trigger, which hard-codes role = 'patient'. No
-- policy grants ANY authenticated user update access to profiles, so an
-- UPDATE naming their own row matches zero rows under RLS and silently
-- no-ops (Postgres does not raise for an UPDATE that matches no rows —
-- there is nothing to catch with throws_ok here). The invariant that
-- actually matters is that the row's role is unchanged afterward.
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

update profiles set role = 'front_desk' where id = '11111111-1111-1111-1111-111111111111';

select is(
  (select role::text from profiles where id = '11111111-1111-1111-1111-111111111111'),
  'patient',
  'a patient cannot escalate their own role via update (RLS matches zero rows)'
);

-- 3. inserting a second appointment for the same doctor+time fails.
-- Run as the front_desk user, who has insert access to appointments via the
-- appointments_front_desk policy; the unique constraint on
-- (doctor_id, scheduled_at) collides with the fixture appointment already
-- booked for doctor A at 2026-10-01 09:00+00.
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);

select throws_ok(
  $$ insert into appointments (patient_id, doctor_id, scheduled_at, source)
     values ('11111111-1111-1111-1111-111111111111',
             '33333333-3333-3333-3333-333333333333',
             '2026-10-01 09:00+00',
             'front_desk') $$,
  '23505',
  null,
  'duplicate doctor+time slot is rejected by the unique constraint'
);

select * from finish();
rollback;
