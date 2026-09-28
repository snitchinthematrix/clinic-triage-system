-- supabase/tests/rls.test.sql
-- pgTAP regression tests for the RLS policies in 0002_rls_policies.sql,
-- 0003_auth_provisioning_and_read_policies.sql, 0004_important_findings.sql,
-- and 0005_minor_findings.sql. Covers the plan's Review Focus items,
-- positive controls, the C1 privilege-escalation fix, the I5/I6/I7/I8
-- fixes, and the Minor findings (doctor column restriction, front_desk
-- profile editing without role escalation, atomic booking RPC) from the
-- post-implementation code review.

create extension if not exists pgtap with schema extensions;

begin;
select plan(21);

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

-- 4. I5: cancelling the appointment frees the slot back up. The unique
-- index is partial (where status not in ('cancelled', 'no_show')), so once
-- patient A's appointment is cancelled, a NEW appointment for the same
-- doctor+time must be insertable, not permanently blocked.
update appointments set status = 'cancelled' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select lives_ok(
  $$ insert into appointments (id, patient_id, doctor_id, scheduled_at, source)
     values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
             '22222222-2222-2222-2222-222222222222',
             '33333333-3333-3333-3333-333333333333',
             '2026-10-01 09:00+00',
             'front_desk') $$,
  'a cancelled slot can be rebooked (I5)'
);

-- 5. I6a: a patient cannot escalate their own appointment's urgency_level
-- via UPDATE (the restrict_patient_appointment_update trigger blocks it).
-- Uses patient B's appointment, which test 4 above did not touch.
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);

select throws_ok(
  $$ update appointments set urgency_level = 'emergency'
     where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' $$,
  'P0001',
  null,
  'a patient cannot set their own appointment urgency_level to emergency (I6)'
);

-- 5b. I6b: a patient CAN still reschedule (change scheduled_at) — the
-- trigger only blocks doctor_id/patient_id/urgency_level/source and status
-- transitions other than to 'cancelled', not scheduled_at.
select lives_ok(
  $$ update appointments set scheduled_at = '2026-10-02 10:00+00'
     where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' $$,
  'a patient can still reschedule their own appointment (I6)'
);

-- 6. I7: a doctor can read the record of a patient they have an
-- appointment with, but not one they've never seen.
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);

select isnt_empty(
  $$ select * from patients where profile_id = '11111111-1111-1111-1111-111111111111' $$,
  'doctor A can read a patient they have an appointment with (I7)'
);

select is_empty(
  $$ select * from patients where profile_id = '66666666-6666-6666-6666-666666666666' $$,
  'doctor A cannot read a patient they have never seen (I7)'
);

-- 6b. Minor: a doctor cannot reassign their own appointment to a
-- different patient, but CAN update its status (progressing the queue).
select throws_ok(
  $$ update appointments set patient_id = '66666666-6666-6666-6666-666666666666'
     where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' $$,
  'P0001',
  null,
  'a doctor cannot reassign their own appointment to a different patient'
);

select lives_ok(
  $$ update appointments set status = 'checked_in'
     where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' $$,
  'a doctor can still update their own appointment status'
);

-- 7. I8: a patient can no longer read visit_notes directly at all (the
-- patient-read policy was dropped), only through get_my_visit_summaries(),
-- which returns only the AI patient summary, never doctor_raw_notes.
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

select is_empty(
  $$ select * from visit_notes where appointment_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  'a patient cannot read visit_notes directly at all (I8)'
);

select isnt_empty(
  $$ select * from get_my_visit_summaries()
     where ai_patient_summary = 'You have a mild headache. Rest and stay hydrated.' $$,
  'a patient can read their own AI summary via get_my_visit_summaries() (I8)'
);

-- 8. Minor: front_desk can edit a patient's profile (name/phone), but
-- cannot use that same access to change the profile's role.
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);

select lives_ok(
  $$ update profiles set full_name = 'Patient A (updated)'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  'front_desk can edit a patient profile (minor: profile editing)'
);

select throws_ok(
  $$ update profiles set role = 'doctor'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  'P0001',
  null,
  'front_desk cannot use profile-edit access to escalate a role'
);

-- 9. Minor: book_appointment_with_triage() creates the appointment and
-- its triage_submissions row atomically in one call.
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

select book_appointment_with_triage(
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  '2026-10-03 09:00+00',
  'self_booked',
  'soon',
  'new symptom via RPC',
  'General Practice',
  '{"urgency":"soon"}'::jsonb
);

select isnt_empty(
  $$ select * from appointments
     where doctor_id = '33333333-3333-3333-3333-333333333333'
       and scheduled_at = '2026-10-03 09:00+00' $$,
  'book_appointment_with_triage creates the appointment'
);

select isnt_empty(
  $$ select * from triage_submissions where symptom_text = 'new symptom via RPC' $$,
  'book_appointment_with_triage creates the matching triage_submissions row atomically'
);

-- 10. Minor: front_desk can persist a computed no-show risk score.
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);

select lives_ok(
  $$ insert into no_show_scores (appointment_id, risk_score)
     values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 0.42) $$,
  'front_desk can persist a no-show risk score'
);

select * from finish();
rollback;
