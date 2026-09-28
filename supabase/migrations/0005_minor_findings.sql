-- supabase/migrations/0005_minor_findings.sql
-- Fixes three Minor-severity findings from the post-implementation code
-- review that were deferred in the Critical/Important fix passes.

-- Minor: appointments_doctor_update let a doctor change patient_id or
-- scheduled_at on their own rows (reassigning the patient or moving the
-- slot), which should be a front-desk/patient action, not a doctor one.
-- Generalize the existing patient-only restriction trigger to also cover
-- doctors: they may still update status (progress through their queue)
-- and urgency_level (reassess after seeing the patient), but not
-- doctor_id, patient_id, scheduled_at, or source.
drop trigger if exists restrict_patient_appointment_update_trigger on appointments;
drop function if exists restrict_patient_appointment_update();

create or replace function restrict_appointment_update()
returns trigger
language plpgsql
as $$
begin
  if current_role_value() = 'patient' then
    if new.doctor_id is distinct from old.doctor_id
       or new.patient_id is distinct from old.patient_id
       or new.urgency_level is distinct from old.urgency_level
       or new.source is distinct from old.source
    then
      raise exception 'patients cannot modify doctor_id, patient_id, urgency_level, or source';
    end if;

    if new.status is distinct from old.status and new.status <> 'cancelled' then
      raise exception 'patients can only change status to cancelled';
    end if;
  elsif current_role_value() = 'doctor' then
    if new.doctor_id is distinct from old.doctor_id
       or new.patient_id is distinct from old.patient_id
       or new.scheduled_at is distinct from old.scheduled_at
       or new.source is distinct from old.source
    then
      raise exception 'doctors cannot modify doctor_id, patient_id, scheduled_at, or source';
    end if;
  end if;

  return new;
end;
$$;

create trigger restrict_appointment_update_trigger
  before update on appointments
  for each row execute function restrict_appointment_update();

-- Minor: bookAppointment (apps/web/src/features/patient/appointmentsApi.ts)
-- inserted the appointment and then the triage_submissions row as two
-- separate client round-trips — if the second insert failed, the
-- appointment existed with no triage record and the error was silently
-- swallowed. Move both into a single Postgres function: since a function
-- body runs inside the same transaction as the statement that calls it,
-- a failure partway through rolls back the whole thing automatically.
-- Not security definer, so it still runs as the calling (invoker) role —
-- the existing appointments/triage_submissions RLS policies still apply,
-- preserving the same security properties as the two-call version.
create or replace function book_appointment_with_triage(
  p_doctor_id uuid,
  p_patient_id uuid,
  p_scheduled_at timestamptz,
  p_source text,
  p_urgency_level triage_urgency,
  p_symptom_text text,
  p_suggested_department text,
  p_raw_response jsonb
) returns uuid
language plpgsql
as $$
declare
  v_appointment_id uuid;
begin
  insert into appointments (doctor_id, patient_id, scheduled_at, source, urgency_level)
  values (p_doctor_id, p_patient_id, p_scheduled_at, p_source, p_urgency_level)
  returning id into v_appointment_id;

  if p_symptom_text is not null then
    insert into triage_submissions (patient_id, appointment_id, symptom_text, ai_urgency, ai_suggested_department, ai_raw_response)
    values (p_patient_id, v_appointment_id, p_symptom_text, p_urgency_level, p_suggested_department, p_raw_response);
  end if;

  return v_appointment_id;
end;
$$;

grant execute on function book_appointment_with_triage(uuid, uuid, timestamptz, text, triage_urgency, text, text, jsonb) to authenticated;

-- Minor: front_desk had no way to edit a patient's name/phone (profiles
-- has no update policy for anyone but the row owner, via profiles_self_*,
-- which front_desk isn't). Grant front_desk update access to profiles,
-- but — mirroring the patient/doctor appointment restriction above — add
-- a trigger blocking any change to `role`, since profiles has no other
-- guard against a front_desk user using this new access to escalate a
-- patient (or their own) row to 'doctor'/'front_desk'.
create policy profiles_front_desk_update on profiles for update
  using (current_role_value() = 'front_desk')
  with check (current_role_value() = 'front_desk');

create or replace function restrict_profile_role_update()
returns trigger
language plpgsql
as $$
begin
  -- Scoped to front_desk specifically (the only client-facing role this
  -- migration grants UPDATE on profiles to — patients/doctors have no
  -- update policy on profiles at all, so RLS already blocks them before
  -- reaching this trigger). Unscoped, this would also fire for admin/
  -- fixture-loading connections that update role directly as a superuser
  -- (e.g. provisioning a doctor account), which must still be possible.
  if current_role_value() = 'front_desk' and new.role is distinct from old.role then
    raise exception 'front_desk cannot change a profile''s role';
  end if;
  return new;
end;
$$;

drop trigger if exists restrict_profile_role_update_trigger on profiles;
create trigger restrict_profile_role_update_trigger
  before update on profiles
  for each row execute function restrict_profile_role_update();
