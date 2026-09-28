-- supabase/tests/seed.sql
-- Fixture data for the RLS regression tests in rls.test.sql.
-- Loaded with \i from inside the test's begin/rollback block, so it never
-- persists outside a single pgTAP test run.

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'patient-a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'patient-b@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'doctor-a@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'frontdesk@example.com');

insert into public.profiles (id, role, full_name) values
  ('11111111-1111-1111-1111-111111111111', 'patient', 'Patient A'),
  ('22222222-2222-2222-2222-222222222222', 'patient', 'Patient B'),
  ('33333333-3333-3333-3333-333333333333', 'doctor', 'Doctor A'),
  ('44444444-4444-4444-4444-444444444444', 'front_desk', 'Front Desk User');

insert into public.patients (profile_id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

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
