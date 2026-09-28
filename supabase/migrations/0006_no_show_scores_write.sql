-- supabase/migrations/0006_no_show_scores_write.sql
-- Minor finding: no_show_scores was select-only for everyone (front_desk,
-- doctor) — the heuristic was computed client-side in NoShowDashboard but
-- never persisted anywhere, so there was no historical record and no way
-- for anything else (a report, a future scheduled job) to read it back.
-- Grants front_desk write access, matching the pattern already used for
-- appointments_front_desk in 0002_rls_policies.sql.
create policy no_show_front_desk_write on no_show_scores for insert
  with check (current_role_value() = 'front_desk');
create policy no_show_front_desk_update on no_show_scores for update
  using (current_role_value() = 'front_desk')
  with check (current_role_value() = 'front_desk');
