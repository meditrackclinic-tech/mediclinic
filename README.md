# Intelligent Patient Symptom Record Management System

This is an academic prototype for selected public and private clinics in the Khomas Region, Namibia. It captures patient-reported symptoms, structures them using a lightweight NLP module, and tracks symptom history over time.

The system is not a diagnostic tool. It does not recommend treatment and must not replace professional clinical judgment.

## Project Structure

```text
client/
  src/pages/admin/    Admin frontend pages
  src/pages/nurse/    Nurse frontend pages
  src/pages/doctor/   Doctor frontend pages
  src/pages/public/   Public landing/home page
  src/shared/         Reusable frontend components
server/               Node.js Express backend, NLP module, PostgreSQL-backed data access
docs/                 Architecture and API notes
```

## Quick Start

```bash
npm.cmd install
npm.cmd run dev
```

If ports are already in use, run:

```bash
npm.cmd run dev:reset
```

Frontend: `http://localhost:5173`  
Backend API: `http://localhost:4000/api`

## Initial Admin Login

```text
Email: admin@example.com
Password: Admin123!
```

Patients are records inside the clinic workflow. They do not log in to this prototype.
Nurse and doctor accounts must be created by the system admin from **Admin > Users**.

## PostgreSQL Data Store

The backend uses PostgreSQL for roles, clinics, users, patients, symptom records, vitals, and audit logs when `DATABASE_URL` is set.

1. Create a PostgreSQL role and database:

```sql
CREATE USER patient_record_app WITH PASSWORD 'your_local_password';
CREATE DATABASE patient_record_nlp OWNER patient_record_app;
```

2. Create `server/.env` from `server/.env.example`.
3. Set your local connection string:

```text
DATABASE_URL=postgresql://patient_record_app:your_local_password@localhost:5432/patient_record_nlp
```

4. Start the server with `npm.cmd run dev:reset`.

On startup, the backend creates the required tables automatically and seeds only one protected system admin account.

Email delivery is optional at first. If SMTP settings are empty, new staff login details are printed in the server console for local development.

## Main Features

- Role-based authentication.
- One protected system admin account.
- Admin-created staff accounts with temporary passwords.
- First-login password change for new staff accounts.
- Admin password reset for nurse and doctor accounts.
- Staff security page for changing the signed-in user's own password.
- Patient registration and search.
- Free-text symptom submission.
- NLP extraction for symptom, duration, severity, body part, and temporal clues.
- Storage of raw symptom text and structured symptom output.
- Patient symptom history and timeline views.
- Basic dashboard metrics.
- Tailwind CSS styling with role-based frontend pages.

## Testing

```bash
npm.cmd test
```

Tests currently cover NLP extraction and core API behavior.
