-- supabase/migrations/0003_auth_provisioning_and_read_policies.sql
--
-- Fixes two review findings against 0002_rls_policies.sql:
--
-- 1. (Critical) profiles_self_insert let ANY authenticated user insert their
--    own profiles row with an arbitrary role, including 'doctor' or
--    'front_desk' — a privilege escalation. Provisioning now happens
--    server-side, in a security-definer trigger on auth.users that always
--    hard-codes role = 'patient'. The client insert policy is dropped.
--
-- 2. (Critical) profiles and doctors had no read policies beyond
--    "read your own profile", so doctor/front-desk/patient UI that joins
--    through profiles(full_name) or lists doctors returned nothing.

-- Patient self-signup no longer inserts into profiles/patients directly;
-- the trigger below does it, so the escalation vector is closed.
drop policy if exists profiles_self_insert on profiles;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (new.id, 'patient', coalesce(new.raw_user_meta_data ->> 'full_name', ''));

  insert into public.patients (profile_id)
  values (new.id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- current_role_value() queries profiles, and 0002 originally only ever
-- used it in policies on OTHER tables (patients, appointments, ...), so
-- that inner query never hit RLS recursively. The policies below put
-- current_role_value() into a policy ON profiles itself for the first
-- time (profiles_front_desk_read, profiles_doctor_read_own_patients) —
-- without this, its own "select role from profiles where id = auth.uid()"
-- would be evaluated under profiles' own RLS, re-entering the very policy
-- being evaluated and blowing the stack ("stack depth limit exceeded").
-- security definer makes the inner query run as the function owner,
-- bypassing RLS, which breaks the recursion.
create or replace function current_role_value() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

-- doctors: every authenticated user can read the doctor list (needed to
-- book with a doctor and to render doctor names in queue/calendar views);
-- only the doctor themself can update their own row.
create policy doctors_select_authenticated on doctors for select
  using (auth.role() = 'authenticated');
create policy doctors_self_update on doctors for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- profiles: front_desk can read everyone's profile (needed for the master
-- calendar / check-in / patient record UI); a doctor can read the profile
-- of any patient they have an appointment with; anyone can read a doctor's
-- profile (needed to show doctor names to patients and other staff).
create policy profiles_front_desk_read on profiles for select
  using (current_role_value() = 'front_desk');
create policy profiles_doctor_read_own_patients on profiles for select
  using (
    current_role_value() = 'doctor'
    and exists (
      select 1 from appointments a
      where a.patient_id = profiles.id and a.doctor_id = auth.uid()
    )
  );
create policy profiles_read_doctors on profiles for select
  using (role = 'doctor');
