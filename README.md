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
nlp-service/          Optional localhost Hugging Face clinical NER service
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

## Optional Hugging Face NLP

The normal app uses the built-in context-aware rule model. To compare it with the selected Hugging Face clinical entity model, install the local service once:

```powershell
npm.cmd run nlp:setup
```

Then set `NLP_PROVIDER=hybrid` in `server/.env`. Start the model service in one terminal and the app in another:

```powershell
npm.cmd run nlp:start
npm.cmd run dev
```

The first model start downloads the pinned model files. Complaint text stays on the computer: the backend calls only `http://127.0.0.1:8001`. If the model service stops, intake automatically falls back to the built-in extractor. The selection rationale and measurement plan are in [`docs/nlp-model-evaluation.md`](docs/nlp-model-evaluation.md).

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

## Supabase Database

Supabase is supported as the hosted PostgreSQL provider. The Express backend continues to own authentication and database access; the browser never receives the Supabase database password or service credentials.

1. Create an empty Supabase project.
2. In **Project > Connect**, select the **Session pooler** connection string on port `5432`. If that port times out on your network, use the **Transaction pooler** connection string on port `6543` instead. Both modes are supported: the migration stays inside one transaction on one connection, and the app uses unnamed parameterized queries rather than named prepared statements.
3. Stop the running app with **Ctrl+C** so records do not change during the migration.
4. Run the secure migration prompt from the project root. You can paste the URI with `[YOUR-PASSWORD]` still in it; the script asks for the password separately and encodes it for you. Both inputs are hidden:

```powershell
npm.cmd run database:migrate:supabase
```

The migration:

- creates and checks a local PostgreSQL backup in `%LOCALAPPDATA%\MediTrack\backups` (outside the repository);
- refuses to run while the app's backend port is listening;
- refuses to overwrite a target that already contains any MediTrack tables;
- checks every table's columns before copying any rows, reporting missing or extra fields instead of skipping them;
- creates the schema and copies roles, clinics, staff, patients, visits, symptoms, vitals, prescriptions, and audit logs in one target transaction;
- preserves password hashes, digital queue numbers and timestamps, JSON arrays, SQL arrays, birth dates, and full timestamp precision;
- intentionally excludes active login sessions, so staff must sign in again;
- enables Row Level Security and revokes public, anonymous, and authenticated Data API access on every application table; the Express backend remains responsible for access;
- verifies row counts and SHA-256 content digests before committing;
- saves the original environment file with the local backups, then switches `server/.env` after verification.

After the script reports success, restart the app and verify the active database (in another terminal):

```powershell
npm.cmd run dev
npm.cmd run database:verify
```

Keep `DATABASE_URL` only in `server/.env` or the deployment platform's secret settings. Never add it to the frontend or commit it to Git.

Supabase connections use encrypted TLS with certificate verification and the public root certificate bundled in `server/certs`. Leave `DATABASE_SSL_REJECT_UNAUTHORIZED=true`; do not disable verification to work around certificate errors. An optional `DATABASE_SSL_CA` overrides the bundled certificate for deployments with a different trusted CA. The migration can remember a non-secret `SUPABASE_CONNECTION_TEMPLATE` in `server/.env`, with `[YOUR-PASSWORD]` as the password placeholder, so only the password is requested on each attempt.

The source database is not deleted or modified. The backup archive includes the original sessions, while the Supabase copy intentionally excludes them. Restoring the saved environment file reconnects the app to the local database, but records entered after switching to Supabase would need to be reconciled before rolling back. To copy without switching, run `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\migrate-to-supabase.ps1 -CopyOnly`.

For a local-only rehearsal before migration, run `npm.cmd run database:rehearse`. It reads the existing local database, initializes an isolated schema, copies and verifies all application records, and then rolls back the entire temporary schema. It does not change the original tables or application settings, and it does not connect to Supabase. This checks schema and data compatibility; it does not test Supabase credentials or connectivity.

## Main Features

- Role-based authentication.
- One protected system admin account.
- Admin-created staff accounts with temporary passwords.
- First-login password change for new staff accounts.
- Admin password reset for nurse and doctor accounts.
- Staff security page for changing the signed-in user's own password.
- Patient registration and search.
- Free-text symptom submission.
- Context-aware NLP extraction for symptom, negation, duration, severity, body part, and temporal clues.
- Optional local Hugging Face clinical entity extraction with automatic rule-based fallback.
- Storage of raw symptom text and structured symptom output.
- Patient symptom history and timeline views.
- Basic dashboard metrics.
- Tailwind CSS styling with role-based frontend pages.

## Testing

```bash
npm.cmd test
```

Tests currently cover NLP extraction and core API behavior.
