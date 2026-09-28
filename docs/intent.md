# Intent

- **Purpose:** a real clinic appointment booking + patient triage system,
  usable by an actual small practice, not just a portfolio demo.
- **Audience:** three roles — patients, doctors, front-desk admin staff.
- **Constraints:** zero API/hosting budget (free-tier only), mobile native
  apps wanted eventually (API-first backend), solid security practices but
  not full HIPAA compliance for v1, UI must be intuitive enough for
  non-technical clinic staff and patients to adopt without training.
- **Success criteria for v1:** all three roles can complete their full core
  workflow (patient books via AI-triaged intake → doctor sees prioritized
  queue with AI-summarized notes → front-desk manages calendar/check-in/
  no-show risk) end-to-end on free-tier infrastructure.

This file captures the *why* behind the project and is kept separate from
the more technical design/spec documents so it survives even as the
technical plan evolves. See `docs/superpowers/specs/` for the technical
design and `docs/superpowers/specs/` implementation plans for how this
intent is being executed.
