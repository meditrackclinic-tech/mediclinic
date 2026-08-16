# Shared Frontend Code

This folder contains code reused by multiple user roles.

- `shell/`: Layout used by logged-in pages.
- `patient-workspace/`: Legacy reusable patient registration, symptom capture, patient list, and timeline components. Active patient creation now belongs to the receptionist workspace.

Role-specific pages should stay inside `src/pages/<role>/`. Shared UI should only live here when at least two roles use it.
