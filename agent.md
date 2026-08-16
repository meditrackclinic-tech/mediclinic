# Agent Instructions: Intelligent Patient Symptom Record Management System

## Project Purpose

This project is an academic prototype for a web-based intelligent patient symptom record management system for selected private and public clinics in the Khomas Region, Namibia.

The system should help clinic staff capture, structure, retrieve, and track patient-reported symptoms over time. It uses Natural Language Processing (NLP) to transform free-text symptom descriptions into structured symptom records.

This system must not diagnose patients, recommend treatment, or replace professional clinical judgment. It only supports record organization, symptom tracking, and clinical workflow efficiency.

## Expected Architecture

Build the project as a layered web application with these main components:

- Frontend: React-based user interface for login, receptionist patient registration, nurse quick assessment, symptom entry, patient search, symptom history, dashboards, and timeline views.
- Backend API: Node.js/Express service for authentication, authorization, patient records, symptom submission, retrieval, NLP processing coordination, and reporting.
- NLP module: Processes patient-reported free text and extracts structured details such as symptom name, duration, severity, body part, and temporal expressions.
- Database: Stores users, patients, raw symptom descriptions, structured NLP output, timestamps, roles, and audit logs.
- Temporal tracking: Displays symptom history over time using timelines, tables, or simple trend views.
- Security layer: Handles authentication, role-based access control, password hashing, data privacy, and audit logging.

## Core Data Flow

1. The patient arrives at the clinic front desk.
2. The receptionist searches for the patient and creates one long-term patient record only if no record exists.
3. The nurse opens Quick Assessment for that existing patient record.
4. The nurse records compact vital signs and enters the complaint using quick symptom buttons plus short text.
5. The NLP module extracts structured symptom details from the complaint.
6. The nurse confirms the NLP structure only when needed.
7. The nurse treats and completes the visit when appropriate, or sends the assessment to the doctor queue.
8. The doctor reviews the nurse handoff, history insight, and NLP summary, then records diagnosis/outcome.
9. The visit is saved under the patient’s long-term digital record.
10. A future Digital Patient Passport app can later link to that record.

## Implementation Rules

- Keep the scope focused on an academic prototype.
- Do not build or describe the system as a diagnostic AI.
- Store the original patient-reported symptom text and the structured NLP output.
- Use timestamps on all symptom records to support temporal tracking.
- Use clear API boundaries between frontend, backend, NLP processing, and database access.
- Protect patient information through authentication, role-based access, and secure storage practices.
- Use anonymized, simulated, or consent-approved data during testing.
- Avoid unnecessary national health system integration, hospital-wide modules, billing features, pharmacy features, or treatment recommendation features.
- Make the interface simple enough for clinic staff to use in a busy environment.

## Suggested User Roles

- Admin: One protected seeded system administrator account that creates and manages staff accounts.
- Receptionist: Searches existing patient records and creates new patient profiles before clinical assessment.
- Nurse: Opens existing patient records, records vitals, captures complaints, uses NLP, treats when appropriate, or sends to the doctor.
- Doctor or clinician: Reviews structured symptom records, patient history, and temporal symptom timelines.
Patients are records in the clinic workflow, not login users in this prototype.

## Suggested Database Entities

Use a structured database design that supports at least:

- Roles: protected role definitions for admin, receptionist, nurse, and doctor.
- Clinics: selected prototype clinic site metadata.
- Users: staff identity, login details, role reference, account status, and temporary-password flag.
- Patients: patient profile details required for the prototype.
- Symptom records: raw symptom descriptions, timestamps, patient references, and recording user.
- Structured symptoms: extracted symptom name, severity, duration, body part, temporal markers, and confidence if available.
- Vitals: patient vital signs recorded during intake.
- Audit logs: user actions, timestamps, and affected records.

Avoid storing unnecessary sensitive details. Keep patient data minimal and relevant to the research prototype.

## NLP Expectations

The NLP module should focus on extracting useful structure from patient-reported symptom text. Useful fields include:

- Symptom names, such as cough, headache, fever, chest pain, nausea, or dizziness.
- Duration, such as "three days", "since Monday", or "two weeks".
- Severity, such as mild, moderate, severe, worsening, or improving.
- Body part, such as head, chest, stomach, throat, or back.
- Temporal clues, such as started, continued, improved, worsened, recurring, or resolved.

For the prototype, rule-based extraction, keyword matching, lightweight NLP libraries, or an existing model may be used. Accuracy should be evaluated by comparing system output with manually checked examples.

## API Guidance

Design APIs that are predictable and easy to test. Suggested endpoint groups include:

- Authentication: login, logout, current user.
- Users and roles: create user, update role, list users if admin.
- Patients: create patient only as receptionist/admin, update patient, search patients, view patient profile.
- Symptoms: submit symptom text, view structured symptom record, list patient symptom history.
- Timeline: retrieve patient symptom timeline grouped by date or symptom.
- Reports: simple dashboard metrics such as recent submissions and common symptoms.

Return clear validation errors and avoid exposing sensitive information in API responses.

## Testing Expectations

Include tests or test procedures for:

- User authentication and role-based access.
- Patient creation and retrieval.
- Symptom submission using free-text input.
- NLP extraction for symptom, duration, and severity.
- Storage of both raw and structured symptom data.
- Retrieval of patient symptom history.
- Timeline or trend display behavior.
- API error handling for missing, invalid, or unauthorized requests.

Postman can be used for API testing, and Jest can be used for backend unit or integration tests if the project uses Node.js.

## Research Constraints

This project is limited to selected public and private clinics in the Khomas Region, Namibia. It is intended for academic research and prototype evaluation, not full production deployment.

The study uses a small sample of healthcare practitioners and patients for testing and feedback. Results should not be presented as nationally generalizable.

The system excludes:

- Clinical diagnosis.
- Treatment recommendations.
- Full hospital management.
- Billing and pharmacy management.
- National health platform integration.
- Large-scale production deployment.

## Documentation Guidance

When adding features, document:

- What the feature does.
- Which user role can access it.
- Which data it reads or writes.
- How it supports symptom record management or temporal tracking.
- Any privacy or ethical considerations.

Keep documentation clear, practical, and aligned with the research proposal.
