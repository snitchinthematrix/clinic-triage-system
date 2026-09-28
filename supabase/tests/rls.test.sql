-- supabase/tests/rls.test.sql
-- pgTAP regression tests for the RLS policies in 0002_rls_policies.sql.
-- Covers the three Review Focus items:
--   1. A patient cannot read another patient's appointments.
--   2. front_desk has zero access to visit_notes (clinical note content).
--   3. Double-booking the same doctor at the same time is rejected by the
--      unique (doctor_id, scheduled_at) constraint.

create extension if not exists pgtap with schema extensions;

begin;
select plan(3);

-- Fixtures: two patients, one doctor, one front_desk user, two appointments,
-- and one visit_note. Loaded as the superuser/owner role, which bypasses RLS.
\ir seed.sql

-- 1. patient A cannot select patient B's appointments.
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

select is_empty(
  $$ select * from appointments where patient_id = '22222222-2222-2222-2222-222222222222' $$,
  'patient A cannot read patient B appointments'
);

-- 2. front_desk cannot select any row from visit_notes.
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);

select is_empty(
  $$ select * from visit_notes $$,
  'front_desk cannot read visit_notes at all'
);

-- 3. inserting a second appointment for the same doctor+time fails.
-- Run as the front_desk user, who has insert access to appointments via the
-- appointments_front_desk policy; the unique constraint on
-- (doctor_id, scheduled_at) collides with the fixture appointment already
-- booked for doctor A at 2026-10-01 09:00+00.
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
