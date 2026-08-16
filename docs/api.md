# API Notes

Base URL: `/api`

## Auth

- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`
- `POST /auth/change-password`
- `POST /auth/first-login-password`

Login returns a JWT plus a server-side session id and expiry. Protected requests require a token whose session is still active, not expired, and not revoked.

## Users

- `GET /users` admin only
- `GET /users/roles` admin only
- `GET /users/email-status` admin only
- `POST /users/email-test` admin only
- `POST /users` admin only
- `PATCH /users/:id` admin only
- `POST /users/:id/reset-password` admin only, staff accounts only

## Patients

- `GET /patients`
- `POST /patients`
- `GET /patients/:id`

## Symptoms

- `POST /symptoms`
- `GET /symptoms/patient/:patientId`
- `GET /symptoms/patient/:patientId/timeline`

## Vitals

- `POST /vitals`
- `GET /vitals/patient/:patientId`

## Reports

- `GET /reports/summary`

## Audit Logs

- `GET /audit-logs` admin only

All protected endpoints require:

```text
Authorization: Bearer <token>
```
