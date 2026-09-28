-- supabase/migrations/0004_important_findings.sql
-- Fixes four Important-severity findings from the post-implementation
-- code review (docs/implementation-evidence.md has the full list).

-- I5: the unique (doctor_id, scheduled_at) constraint counted cancelled
-- and no_show rows, so a cancelled slot could never be rebooked by
-- anyone. Replace it with a partial unique index that only counts rows
-- still occupying the slot.
alter table appointments drop constraint appointments_doctor_id_scheduled_at_key;
create unique index appointments_doctor_id_scheduled_at_active_key
  on appointments (doctor_id, scheduled_at)
  where status not in ('cancelled', 'no_show');

-- I7: patients_doctor_read let every doctor read every patient's record
-- (DOB, insurance info), not just their own patients'. Scope it to
-- patients the doctor actually has an appointment with.
drop policy patients_doctor_read on patients;
create policy patients_doctor_read on patients for select
  using (
    current_role_value() = 'doctor'
    and exists (
      select 1 from appointments a
      where a.patient_id = patients.profile_id and a.doctor_id = auth.uid()
    )
  );

-- I6: appointments_patient and triage_patient were both `for all`, so a
-- patient could UPDATE their own appointment's urgency_level to
-- 'emergency' to jump the doctor's queue, change status to
-- checked_in/done, or reassign doctor_id — and could rewrite
-- ai_urgency/ai_raw_response on their own triage_submissions, or insert a
-- triage row pointing at an appointment_id that isn't theirs.

-- triage_submissions: split into select/insert only (no update/delete for
-- patients at all), and require the appointment_id to belong to them.
drop policy triage_patient on triage_submissions;
create policy triage_patient_select on triage_submissions for select
  using (patient_id = auth.uid());
create policy triage_patient_insert on triage_submissions for insert
  with check (
    patient_id = auth.uid()
    and (
      appointment_id is null
      or appointment_id in (select id from appointments where patient_id = auth.uid())
    )
  );

-- appointments: keep the existing broad `for all` policy (front_desk and
-- doctor flows still need it for their own scoped rows via the other
-- policies), but add a trigger that, specifically for the patient role,
-- only allows changing scheduled_at (reschedule) or cancelling — never
-- urgency_level, doctor_id, patient_id, or source. RLS policies can't
-- express "some columns only" on their own; a BEFORE UPDATE trigger can,
-- because it sees both OLD and NEW.
create or replace function restrict_patient_appointment_update()
returns trigger
language plpgsql
as $$
begin
  if current_role_value() <> 'patient' then
    return new;
  end if;

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

  return new;
end;
$$;

drop trigger if exists restrict_patient_appointment_update_trigger on appointments;
create trigger restrict_patient_appointment_update_trigger
  before update on appointments
  for each row execute function restrict_patient_appointment_update();

-- I8: visit_notes_patient_read exposed the FULL row (including
-- doctor_raw_notes, the doctor's internal clinical shorthand) to any
-- direct API call from a patient, despite the migration's own comment
-- claiming column-level enforcement "in the API layer" — no such layer
-- exists; the SPA queries Supabase directly. RLS is row-level only, and
-- patient and doctor share the same Postgres role (authenticated), so
-- column-level GRANTs can't distinguish them. Close this by removing
-- patient access to the base table entirely and exposing only the
-- patient-facing summary through a security definer function, which the
-- frontend now calls instead of querying visit_notes directly.
drop policy visit_notes_patient_read on visit_notes;

create or replace function get_my_visit_summaries()
returns table (appointment_id uuid, scheduled_at timestamptz, ai_patient_summary text)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.scheduled_at, vn.ai_patient_summary
  from appointments a
  join visit_notes vn on vn.appointment_id = a.id
  where a.patient_id = auth.uid()
  order by a.scheduled_at desc
$$;

grant execute on function get_my_visit_summaries() to authenticated;
