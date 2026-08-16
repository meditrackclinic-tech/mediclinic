import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;

const shouldUseDatabase =
  process.env.NODE_ENV !== "test" || process.env.USE_POSTGRES_IN_TESTS === "true";

export const hasDatabase = Boolean(env.databaseUrl && shouldUseDatabase);

export const pool = hasDatabase
  ? new Pool({
      connectionString: env.databaseUrl
    })
  : null;

export async function query(text, params = []) {
  if (!pool) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return pool.query(text, params);
}

export async function initializePostgres() {
  if (!pool) {
    return;
  }

  await query(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      is_system BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    INSERT INTO roles (id, name, description)
    VALUES
      ('admin', 'System Administrator', 'The single protected account that creates and manages clinic staff.'),
      ('receptionist', 'Receptionist', 'Front desk role for finding or creating patient records before clinical assessment.'),
      ('nurse', 'Nurse', 'Clinic staff role for quick assessment, vitals, symptom capture, and doctor handoff.'),
      ('doctor', 'Doctor', 'Clinical review role for symptom history and temporal timelines.')
    ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS clinics (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      region TEXT NOT NULL DEFAULT 'Khomas Region',
      clinic_type TEXT NOT NULL DEFAULT 'selected clinic',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    INSERT INTO clinics (id, name, region, clinic_type)
    VALUES ('khomas-prototype-clinic', 'Selected Khomas Clinic', 'Khomas Region', 'prototype site')
    ON CONFLICT (id) DO NOTHING;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'receptionist', 'nurse', 'doctor')),
      role_id TEXT REFERENCES roles(id),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      must_change_password BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_role_check'
          AND conrelid = 'users'::regclass
      ) THEN
        ALTER TABLE users DROP CONSTRAINT users_role_check;
      END IF;

      ALTER TABLE users
      ADD CONSTRAINT users_role_check
      CHECK (role IN ('admin', 'receptionist', 'nurse', 'doctor'));
    END $$;
  `);

  await query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role_id TEXT;
  `);

  await query(`
    UPDATE users
    SET role_id = role
    WHERE role_id IS NULL;
  `);

  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_role_id_fkey'
          AND conrelid = 'users'::regclass
      ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_role_id_fkey
        FOREIGN KEY (role_id) REFERENCES roles(id);
      END IF;
    END $$;
  `);

  await query(`
    ALTER TABLE users
    ALTER COLUMN role_id SET NOT NULL;
  `);

  await query(`
    UPDATE users
    SET role = role_id
    WHERE role IS DISTINCT FROM role_id;
  `);

  await query(`
    WITH extra_admins AS (
      SELECT id
      FROM (
        SELECT
          id,
          ROW_NUMBER() OVER (
            ORDER BY CASE WHEN id = 'admin-user' THEN 0 ELSE 1 END, created_at ASC
          ) AS admin_rank
        FROM users
        WHERE role_id = 'admin'
      ) ranked_admins
      WHERE admin_rank > 1
    )
    UPDATE users
    SET role = 'nurse',
        role_id = 'nurse',
        status = 'inactive',
        updated_at = NOW()
    WHERE id IN (SELECT id FROM extra_admins);
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_single_admin
    ON users (role_id)
    WHERE role_id = 'admin';
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_agent TEXT,
      ip_address TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      patient_number TEXT UNIQUE,
      clinic_id TEXT REFERENCES clinics(id) ON DELETE SET NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      date_of_birth DATE,
      age INTEGER CHECK (age IS NULL OR (age >= 0 AND age <= 130)),
      gender TEXT,
      contact TEXT,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE patients
    ADD COLUMN IF NOT EXISTS patient_number TEXT;
  `);

  await query(`
    ALTER TABLE patients
    ADD COLUMN IF NOT EXISTS date_of_birth DATE;
  `);

  await query(`
    WITH numbered AS (
      SELECT
        id,
        'PT-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC)::text, 6, '0') AS generated_number
      FROM patients
      WHERE patient_number IS NULL
    )
    UPDATE patients
    SET patient_number = numbered.generated_number
    FROM numbered
    WHERE patients.id = numbered.id;
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_patient_number
    ON patients (patient_number)
    WHERE patient_number IS NOT NULL;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS visits (
      id TEXT PRIMARY KEY,
      visit_number TEXT UNIQUE,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      clinic_id TEXT REFERENCES clinics(id) ON DELETE SET NULL,
      nurse_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (
        status IN (
          'draft',
          'in_progress',
          'awaiting_doctor_review',
          'reviewed_by_doctor',
          'returned_for_correction',
          'completed'
        )
      ),
      temperature NUMERIC(4, 1),
      systolic INTEGER,
      diastolic INTEGER,
      heart_rate INTEGER,
      respiratory_rate INTEGER,
      oxygen_saturation INTEGER,
      vitals_notes TEXT,
      symptom_statement TEXT,
      nlp_result JSONB,
      nlp_confirmed BOOLEAN NOT NULL DEFAULT false,
      nurse_corrections JSONB NOT NULL DEFAULT '{}'::jsonb,
      assessment_outcome TEXT,
      treatment_notes TEXT,
      draft_prescription JSONB NOT NULL DEFAULT '{}'::jsonb,
      review_prompt_level TEXT NOT NULL DEFAULT 'routine_review',
      review_prompt_label TEXT NOT NULL DEFAULT 'Routine Review',
      review_prompt_reasons TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      doctor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      doctor_notes TEXT,
      doctor_consultation JSONB NOT NULL DEFAULT '{}'::jsonb,
      continuity_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
      nlp_feedback JSONB NOT NULL DEFAULT '{}'::jsonb,
      patient_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
      submitted_at TIMESTAMPTZ,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE visits
    ADD COLUMN IF NOT EXISTS assessment_outcome TEXT;
  `);

  await query(`
    ALTER TABLE visits
    ADD COLUMN IF NOT EXISTS treatment_notes TEXT;
  `);

  await query(`
    ALTER TABLE visits
    ADD COLUMN IF NOT EXISTS draft_prescription JSONB NOT NULL DEFAULT '{}'::jsonb;
  `);

  await query(`
    ALTER TABLE visits
    ADD COLUMN IF NOT EXISTS doctor_consultation JSONB NOT NULL DEFAULT '{}'::jsonb;
  `);

  await query(`
    ALTER TABLE visits
    ADD COLUMN IF NOT EXISTS continuity_plan JSONB NOT NULL DEFAULT '{}'::jsonb;
  `);

  await query(`
    ALTER TABLE visits
    ADD COLUMN IF NOT EXISTS nlp_feedback JSONB NOT NULL DEFAULT '{}'::jsonb;
  `);

  await query(`
    ALTER TABLE visits
    ADD COLUMN IF NOT EXISTS patient_summary JSONB NOT NULL DEFAULT '{}'::jsonb;
  `);

  await query(`
    ALTER TABLE visits
    ADD COLUMN IF NOT EXISTS visit_type TEXT;
  `);

  await query(`
    ALTER TABLE visits
    ADD COLUMN IF NOT EXISTS history_alerts JSONB NOT NULL DEFAULT '[]'::jsonb;
  `);

  await query(`
    ALTER TABLE visits
    ADD COLUMN IF NOT EXISTS input_method TEXT NOT NULL DEFAULT 'text';
  `);

  await query(`
    ALTER TABLE visits
    ADD COLUMN IF NOT EXISTS original_transcript TEXT;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS doctor_reviews (
      id TEXT PRIMARY KEY,
      visit_id TEXT NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
      doctor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'reviewed_by_doctor',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS symptom_records (
      id TEXT PRIMARY KEY,
      visit_id TEXT REFERENCES visits(id) ON DELETE SET NULL,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      raw_description TEXT NOT NULL,
      structured JSONB NOT NULL,
      symptom_terms TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      severity TEXT,
      duration TEXT,
      body_part TEXT,
      temporal_clues TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      confidence NUMERIC(4, 3),
      recorded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE symptom_records
    ADD COLUMN IF NOT EXISTS visit_id TEXT REFERENCES visits(id) ON DELETE SET NULL;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS vitals (
      id TEXT PRIMARY KEY,
      visit_id TEXT REFERENCES visits(id) ON DELETE SET NULL,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      temperature NUMERIC(4, 1),
      systolic INTEGER,
      diastolic INTEGER,
      heart_rate INTEGER,
      respiratory_rate INTEGER,
      oxygen_saturation INTEGER,
      notes TEXT,
      recorded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    ALTER TABLE vitals
    ADD COLUMN IF NOT EXISTS visit_id TEXT REFERENCES visits(id) ON DELETE SET NULL;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS prescriptions (
      id TEXT PRIMARY KEY,
      visit_id TEXT REFERENCES visits(id) ON DELETE SET NULL,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      medication_name TEXT NOT NULL,
      dose TEXT,
      frequency TEXT,
      duration TEXT,
      quantity TEXT,
      instructions TEXT,
      reason TEXT,
      prescribed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      prescriber_role TEXT,
      dispensed BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users (LOWER(email));
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_users_role_id ON users (role_id);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active
    ON user_sessions (user_id, expires_at DESC)
    WHERE revoked_at IS NULL;
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_patients_name ON patients (LOWER(first_name), LOWER(last_name));
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_visits_patient_created
    ON visits (patient_id, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_visits_status_updated
    ON visits (status, updated_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_symptom_records_patient_created
    ON symptom_records (patient_id, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_vitals_patient_created
    ON vitals (patient_id, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_created
    ON prescriptions (patient_id, created_at DESC);
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
  `);
}
