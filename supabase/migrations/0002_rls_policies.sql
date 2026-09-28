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

-- profiles: everyone can read their own profile; a new user may insert their own row on signup
create policy profiles_self_select on profiles for select
  using (id = auth.uid());
create policy profiles_self_insert on profiles for insert
  with check (id = auth.uid());

-- patients: patient reads/writes own row; doctors read all; front_desk reads AND writes
-- (front_desk needs write access for patient record management, Milestone 5 Task 18)
create policy patients_self on patients for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
create policy patients_doctor_read on patients for select
  using (current_role_value() = 'doctor');
create policy patients_front_desk_write on patients for all
  using (current_role_value() = 'front_desk')
  with check (current_role_value() = 'front_desk');

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
