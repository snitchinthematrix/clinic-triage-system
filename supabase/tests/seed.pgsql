-- supabase/tests/seed.pgsql
-- Named .pgsql (not .sql) deliberately: pg_prove globs supabase/tests/*.sql
-- and would otherwise run this file as its own top-level pgTAP test outside
-- any transaction, permanently committing these fixtures on first run and
-- then colliding on primary keys on every subsequent run (see \ir below).
-- Fixture data for the RLS regression tests in rls.test.sql.
-- Loaded with \ir from inside the test's begin/rollback block, so it never
-- persists outside a single pgTAP test run.

-- Every insert into auth.users fires on_auth_user_created (migration 0003),
-- which auto-provisions a `profiles` row (role = 'patient', hard-coded) and
-- a `patients` row for that id. So all four fixture users already have
-- profiles+patients rows after this insert; the statements below adjust
-- the doctor and front_desk users into their real roles and clean up the
-- patients row the trigger wrongly gave them (a doctor/front_desk account
-- is not also a patient). This runs as the table owner/superuser, which
-- bypasses RLS, exactly as a real admin-provisioning script would need a
-- service-role key to bypass it.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'patient-a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'patient-b@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'doctor-a@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'frontdesk@example.com');

update public.profiles set full_name = 'Patient A' where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set full_name = 'Patient B' where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set role = 'doctor', full_name = 'Doctor A' where id = '33333333-3333-3333-3333-333333333333';
update public.profiles set role = 'front_desk', full_name = 'Front Desk User' where id = '44444444-4444-4444-4444-444444444444';

delete from public.patients where profile_id in (
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444'
);

insert into public.doctors (profile_id, specialty) values
  ('33333333-3333-3333-3333-333333333333', 'General Practice');

insert into public.appointments (id, patient_id, doctor_id, scheduled_at, source) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111',
   '33333333-3333-3333-3333-333333333333',
   '2026-10-01 09:00+00',
   'self_booked'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '22222222-2222-2222-2222-222222222222',
   '33333333-3333-3333-3333-333333333333',
   '2026-10-02 09:00+00',
   'self_booked');

insert into public.visit_notes (appointment_id, doctor_raw_notes) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Patient reports mild headache, no fever.');

insert into public.triage_submissions (id, patient_id, appointment_id, symptom_text) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc',
   '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'mild headache'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd',
   '22222222-2222-2222-2222-222222222222',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'sore throat');
