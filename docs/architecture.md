# System Architecture

## Overview

The application uses a layered web architecture:

```text
React Frontend -> Express Backend API -> NLP Module -> PostgreSQL Data Store
```

The prototype keeps the architecture close to the research proposal while using PostgreSQL for live staff and clinical records. The JSON store remains only as an isolated fallback for automated tests or development without `DATABASE_URL`.

## Components

- Frontend: Login, dashboard, patient registration, symptom submission, symptom timeline, and record search.
- Backend API: Authentication, authorization, validation, patient management, symptom processing, reports, and timeline data.
- NLP module: Extracts structured fields from patient-reported symptom descriptions.
- Data store: Persists roles, clinics, staff users, patients, symptom records, vitals, and audit logs.
- Security controls: Password hashing, JWT authentication, role-based access, and audit logs.

## Database Tables

- `roles`: system roles for admin, nurse, and doctor.
- `clinics`: selected prototype clinic site metadata.
- `users`: staff login accounts. The seeded admin is protected; nurses and doctors are created by admin.
- `patients`: patient records managed by clinic staff.
- `symptom_records`: raw symptom text, structured NLP output, extracted fields, and timestamps.
- `vitals`: patient vital signs recorded by nurses or authorized staff.
- `audit_logs`: login, user-management, patient, symptom, and vitals activity.

## Data Flow

1. A user enters a patient symptom description.
2. The frontend submits the free-text description to the backend.
3. The backend validates the request and calls the NLP module.
4. The NLP module returns structured symptom details.
5. The backend stores the raw text and structured output with timestamps.
6. Authorized users view symptom history and temporal trends.

## Scope Guardrails

The system supports symptom record organization only. It must not diagnose, prescribe, rank clinical risk, or replace clinician judgment.

## Voice-Assisted Nurse Documentation

- **What it does**: Adds an optional voice-capture path to the existing nurse visit-intake form (`NurseIntakePanel`). The nurse can click Start Recording and speak a short clinical summary instead of typing it; the browser's built-in speech recognition (Web Speech API) transcribes the audio to text in an editable field. No audio is stored or transmitted anywhere - only the resulting text is saved, identically to a typed statement. Manual typing remains available at every step and is required as a fallback where the browser does not support speech recognition.
- **Which role can access it**: Nurses (and admins), the same roles that could already record a visit intake. Doctors see the extra structured output (visit type, richer NLP fields, history alerts) on their existing review queue and patient timeline views, read-only.
- **Which data it reads/writes**: Extends the existing `visits` and `symptom_records` tables rather than adding new ones. New `visits` columns: `visit_type`, `history_alerts`, `input_method` (`voice`/`text`), `original_transcript`. The rule-based NLP extractor (`server/src/nlp/symptomExtractor.js`) now also derives `mainComplaint`, `symptomsPresent`/`symptomsAbsent`, `frequency`, `progression`, `medicationAction`, `followUpInstruction`, and a templated `clinicalSummary`, all stored inside the existing `nlp_result`/`structured` JSONB alongside the original fields. A new `server/src/nlp/visitClassifier.js` compares the current visit's structured data against the patient's prior `symptomTimeline` entries to classify the visit type and produce history alerts.
- **How it supports symptom record management / temporal tracking**: The visit type classification (New complaint / Follow-up visit / Recurring complaint / Worsening complaint / Medication review / General consultation) and history alerts give doctors and nurses a temporal read on whether a complaint is new, repeating, or worsening, without any diagnostic inference - it is a comparison against the patient's own recorded history only.
- **Privacy/ethical considerations**: Speech-to-text runs entirely in the nurse's browser; the clinic backend never receives raw audio. The nurse must review and can edit every extracted field, and must explicitly confirm the summary before it can be saved (`nlpConfirmed`). The UI carries an explicit notice that the tool documents and organizes reported information and does not diagnose or replace clinical judgment.
