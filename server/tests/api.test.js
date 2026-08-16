import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

describe("API", () => {
  const app = createApp();

  it("reports health status", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });

  it("logs in with the demo admin account", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "admin@gmail.com",
      password: "Admin123!"
    });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeTruthy();
    expect(response.body.session.id).toBeTruthy();
    expect(response.body.session.expiresAt).toBeTruthy();
    expect(response.body.user.role).toBe("admin");
  });

  it("revokes a token session on logout", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "admin@gmail.com",
      password: "Admin123!"
    });
    const token = loginResponse.body.token;

    const logoutResponse = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`);

    expect(logoutResponse.status).toBe(200);

    const meResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(meResponse.status).toBe(401);
  });

  it("returns live admin system data without clinical report details", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "admin@gmail.com",
      password: "Admin123!"
    });
    const token = loginResponse.body.token;

    const reportResponse = await request(app)
      .get("/api/reports/admin-system")
      .set("Authorization", `Bearer ${token}`);

    expect(reportResponse.status).toBe(200);
    expect(reportResponse.body.totals.staffAccounts).toBeGreaterThanOrEqual(1);
    expect(reportResponse.body.totals.activeSessions).toBeGreaterThanOrEqual(1);
    expect(reportResponse.body.roleDistribution.map((item) => item.role)).toContain("admin");
    expect(reportResponse.body.sessions).toBeTruthy();
    expect(reportResponse.body.securityChecks.length).toBeGreaterThan(0);
    expect(reportResponse.body.commonSymptoms).toBeUndefined();
    expect(reportResponse.body.recentRecords).toBeUndefined();
  });

  it("returns live nurse workflow data for intake dashboards", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "admin@gmail.com",
      password: "Admin123!"
    });
    const token = loginResponse.body.token;

    const reportResponse = await request(app)
      .get("/api/reports/nurse-workflow")
      .set("Authorization", `Bearer ${token}`);

    expect(reportResponse.status).toBe(200);
    expect(reportResponse.body.totals.waitingPatients).toBeGreaterThanOrEqual(0);
    expect(reportResponse.body.totals.vitalsRecordedToday).toBeGreaterThanOrEqual(0);
    expect(reportResponse.body.totals.symptomNotesPending).toBeGreaterThanOrEqual(0);
    expect(reportResponse.body.totals.urgentReviewCount).toBeGreaterThanOrEqual(0);
    expect(reportResponse.body.needsVitals).toBeInstanceOf(Array);
    expect(reportResponse.body.readyForReview).toBeInstanceOf(Array);
    expect(reportResponse.body.hourlyLoad).toHaveLength(8);
    expect(reportResponse.body.vitalsStatus.length).toBeGreaterThan(0);
    expect(reportResponse.body.reminders.length).toBeGreaterThan(0);
  });

  it("allows an admin to create, suspend, reset, and delete a staff user", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "admin@gmail.com",
      password: "Admin123!"
    });
    const token = loginResponse.body.token;
    const email = `test-${Date.now()}@example.com`;

    const createResponse = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Test Nurse",
        email,
        role: "nurse"
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.user.email).toBe(email);
    expect(createResponse.body.user.passwordHash).toBeUndefined();
    expect(createResponse.body.emailDelivery.mode).toBe("console");
    expect(createResponse.body.temporaryPassword).toMatch(/^Med-.+!$/);
    expect(createResponse.body.temporaryPassword).not.toBe("Admin123!");

    const rolesResponse = await request(app)
      .get("/api/users/roles")
      .set("Authorization", `Bearer ${token}`);

    expect(rolesResponse.status).toBe(200);
    expect(rolesResponse.body.roles.map((role) => role.id)).toContain("admin");
    expect(rolesResponse.body.assignableRoles.map((role) => role.id)).toEqual(["receptionist", "nurse", "doctor"]);

    const emailStatusResponse = await request(app)
      .get("/api/users/email-status")
      .set("Authorization", `Bearer ${token}`);

    expect(emailStatusResponse.status).toBe(200);
    expect(emailStatusResponse.body.email.mode).toBe("console");

    const emailTestResponse = await request(app)
      .post("/api/users/email-test")
      .set("Authorization", `Bearer ${token}`)
      .send({ to: email });

    expect(emailTestResponse.status).toBe(200);
    expect(emailTestResponse.body.emailDelivery.mode).toBe("console");

    const staffLoginResponse = await request(app).post("/api/auth/login").send({
      email,
      password: createResponse.body.temporaryPassword
    });

    expect(staffLoginResponse.status).toBe(200);
    expect(staffLoginResponse.body.user.mustChangePassword).toBe(true);

    const passwordResponse = await request(app)
      .post("/api/auth/first-login-password")
      .set("Authorization", `Bearer ${staffLoginResponse.body.token}`)
      .send({
        newPassword: "Changed12345!"
      });

    expect(passwordResponse.status).toBe(200);
    expect(passwordResponse.body.user.mustChangePassword).toBe(false);

    const normalPasswordResponse = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${staffLoginResponse.body.token}`)
      .send({
        currentPassword: "Changed12345!",
        newPassword: "ChangedAgain12345!"
      });

    expect(normalPasswordResponse.status).toBe(200);
    expect(normalPasswordResponse.body.user.mustChangePassword).toBe(false);

    const resetResponse = await request(app)
      .post(`/api/users/${createResponse.body.user.id}/reset-password`)
      .set("Authorization", `Bearer ${token}`);

    expect(resetResponse.status).toBe(200);
    expect(resetResponse.body.user.mustChangePassword).toBe(true);
    expect(resetResponse.body.emailDelivery.mode).toBe("console");

    const adminResetResponse = await request(app)
      .post("/api/users/admin-user/reset-password")
      .set("Authorization", `Bearer ${token}`);

    expect(adminResetResponse.status).toBe(400);

    const adminCreateResponse = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Second Admin",
        email: `admin-${Date.now()}@example.com`,
        role: "admin"
      });

    expect(adminCreateResponse.status).toBe(400);

    const updateResponse = await request(app)
      .patch(`/api/users/${createResponse.body.user.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "inactive" });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.user.status).toBe("inactive");

    const deleteResponse = await request(app)
      .delete(`/api/users/${createResponse.body.user.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.user.id).toBe(createResponse.body.user.id);

    const usersAfterDelete = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${token}`);

    expect(usersAfterDelete.body.users.some((user) => user.id === createResponse.body.user.id)).toBe(false);

    const protectedAdminDelete = await request(app)
      .delete("/api/users/admin-user")
      .set("Authorization", `Bearer ${token}`);

    expect(protectedAdminDelete.status).toBe(400);
  });

  it("allows receptionists, not nurses, to create patient records", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "admin@gmail.com",
      password: "Admin123!"
    });
    const adminToken = loginResponse.body.token;
    const stamp = Date.now();

    const receptionistResponse = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Front Desk User",
        email: `front-desk-${stamp}@example.com`,
        role: "receptionist"
      });

    const nurseResponse = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "No Create Nurse",
        email: `no-create-nurse-${stamp}@example.com`,
        role: "nurse"
      });

    const receptionistLogin = await request(app).post("/api/auth/login").send({
      email: receptionistResponse.body.user.email,
      password: receptionistResponse.body.temporaryPassword
    });
    const nurseLogin = await request(app).post("/api/auth/login").send({
      email: nurseResponse.body.user.email,
      password: nurseResponse.body.temporaryPassword
    });

    const createdByReception = await request(app)
      .post("/api/patients")
      .set("Authorization", `Bearer ${receptionistLogin.body.token}`)
      .send({
        firstName: "Reception",
        lastName: "Patient",
        age: 28,
        gender: "Female",
        contact: "0813333333"
      });

    const blockedNurseCreate = await request(app)
      .post("/api/patients")
      .set("Authorization", `Bearer ${nurseLogin.body.token}`)
      .send({
        firstName: "Blocked",
        lastName: "Patient",
        age: 31,
        gender: "Male"
      });

    expect(createdByReception.status).toBe(201);
    expect(createdByReception.body.patient.patientNumber).toMatch(/^PT-/);
    expect(blockedNurseCreate.status).toBe(403);
  });

  it("allows staff to record patient vitals", async () => {
    const adminLoginResponse = await request(app).post("/api/auth/login").send({
      email: "admin@gmail.com",
      password: "Admin123!"
    });
    const adminToken = adminLoginResponse.body.token;
    const nurseEmail = `vitals-nurse-${Date.now()}@example.com`;

    const createNurseResponse = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Vitals Nurse",
        email: nurseEmail,
        role: "nurse"
      });

    const loginResponse = await request(app).post("/api/auth/login").send({
      email: nurseEmail,
      password: createNurseResponse.body.temporaryPassword
    });
    const token = loginResponse.body.token;

    const patientResponse = await request(app)
      .post("/api/patients")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        firstName: "Vitals",
        lastName: "Patient",
        age: 41,
        gender: "Female",
        contact: "0810000000"
      });

    const vitalsResponse = await request(app)
      .post("/api/vitals")
      .set("Authorization", `Bearer ${token}`)
      .send({
        patientId: patientResponse.body.patient.id,
        temperature: 37.2,
        systolic: 120,
        diastolic: 78,
        heartRate: 82,
        respiratoryRate: 18,
        oxygenSaturation: 98,
        notes: "Stable at intake"
      });

    expect(vitalsResponse.status).toBe(201);
    expect(vitalsResponse.body.vital.heartRate).toBe(82);

    const listResponse = await request(app)
      .get(`/api/vitals/patient/${patientResponse.body.patient.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.vitals).toHaveLength(1);
  });

  it("supports visit-centred nurse intake and doctor handoff submission", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "admin@gmail.com",
      password: "Admin123!"
    });
    const token = loginResponse.body.token;

    const patientResponse = await request(app)
      .post("/api/patients")
      .set("Authorization", `Bearer ${token}`)
      .send({
        firstName: "Visit",
        lastName: "Patient",
        dateOfBirth: "1990-05-10",
        gender: "Female",
        contact: "0811111111"
      });

    expect(patientResponse.status).toBe(201);
    expect(patientResponse.body.patient.patientNumber).toMatch(/^PT-/);

    const patientListResponse = await request(app)
      .get("/api/patients?limit=1&page=1")
      .set("Authorization", `Bearer ${token}`);

    expect(patientListResponse.status).toBe(200);
    expect(patientListResponse.body.patients.length).toBeLessThanOrEqual(1);
    expect(patientListResponse.body.pagination.total).toBeGreaterThanOrEqual(1);

    const startResponse = await request(app)
      .post("/api/visits")
      .set("Authorization", `Bearer ${token}`)
      .send({ patientId: patientResponse.body.patient.id });

    expect(startResponse.status).toBe(201);
    expect(startResponse.body.visit.status).toBe("draft");

    const blockedSubmitResponse = await request(app)
      .post(`/api/visits/${startResponse.body.visit.id}/submit`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        symptomStatement: "Severe chest pain but no fever for 3 days.",
        temperature: 37.2,
        systolic: 124,
        diastolic: 82,
        heartRate: 92,
        respiratoryRate: 20,
        oxygenSaturation: 97,
        nlpConfirmed: false
      });

    expect(blockedSubmitResponse.status).toBe(400);
    expect(blockedSubmitResponse.body.qualityChecks.map((check) => check.field)).toContain("nlpConfirmed");

    const submitResponse = await request(app)
      .post(`/api/visits/${startResponse.body.visit.id}/submit`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        symptomStatement: "Severe chest pain but no fever for 3 days.",
        temperature: 37.2,
        systolic: 124,
        diastolic: 82,
        heartRate: 112,
        respiratoryRate: 22,
        oxygenSaturation: 96,
        nlpConfirmed: true,
        nurseCorrections: {
          symptoms: "chest pain",
          severity: "severe",
          duration: "3 days",
          negatedSymptoms: "fever"
        }
      });

    expect(submitResponse.status).toBe(200);
    expect(submitResponse.body.visit.status).toBe("awaiting_doctor_review");
    expect(submitResponse.body.structured.symptoms).toContain("chest pain");
    expect(submitResponse.body.structured.negatedSymptoms).toContain("fever");
    expect(submitResponse.body.reviewPrompt.level).toBe("prompt_doctor_review");

    const handoffResponse = await request(app)
      .get("/api/visits?status=awaiting_doctor_review")
      .set("Authorization", `Bearer ${token}`);

    expect(handoffResponse.status).toBe(200);
    expect(handoffResponse.body.visits.map((visit) => visit.id)).toContain(startResponse.body.visit.id);

    const doctorReviewResponse = await request(app)
      .post(`/api/visits/${startResponse.body.visit.id}/doctor-review`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        status: "reviewed_by_doctor",
        notes: "Doctor reviewed the nurse handoff and recorded the clinical decision.",
        consultation: {
          examinationNotes: "Patient examined by doctor after nurse handoff.",
          diagnosis: "Doctor-entered clinical assessment",
          outcome: "complete_consultation",
          plan: "Complete the consultation and store the digital record.",
          instructions: "Return to the clinic if symptoms worsen."
        },
        continuityPlan: {},
        nlpFeedback: {
          rating: "accurate"
        }
      });

    expect(doctorReviewResponse.status).toBe(200);
    expect(doctorReviewResponse.body.visit.status).toBe("reviewed_by_doctor");
    expect(doctorReviewResponse.body.visit.doctorNotes).toContain("Doctor reviewed");
    expect(doctorReviewResponse.body.visit.patientSummary.hiddenFromPatient).toContain("Internal NLP confidence scores");

    const updatedQueueResponse = await request(app)
      .get("/api/visits?status=awaiting_doctor_review")
      .set("Authorization", `Bearer ${token}`);

    expect(updatedQueueResponse.body.visits.map((visit) => visit.id)).not.toContain(startResponse.body.visit.id);
  });

  it("allows a nurse assessment to close with treatment and prescription history", async () => {
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "admin@gmail.com",
      password: "Admin123!"
    });
    const token = loginResponse.body.token;

    const patientResponse = await request(app)
      .post("/api/patients")
      .set("Authorization", `Bearer ${token}`)
      .send({
        firstName: "Medicine",
        lastName: "Patient",
        age: 33,
        gender: "Male",
        contact: "0812222222"
      });

    const startResponse = await request(app)
      .post("/api/visits")
      .set("Authorization", `Bearer ${token}`)
      .send({ patientId: patientResponse.body.patient.id });

    const completeResponse = await request(app)
      .post(`/api/visits/${startResponse.body.visit.id}/complete`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        symptomStatement: "Mild headache for 1 day but no fever.",
        temperature: 36.8,
        systolic: 118,
        diastolic: 76,
        heartRate: 78,
        respiratoryRate: 18,
        oxygenSaturation: 99,
        nlpConfirmed: true,
        treatmentNotes: "Medicine issued and patient counselled.",
        nurseCorrections: {
          symptoms: "headache",
          severity: "mild",
          duration: "1 day",
          negatedSymptoms: "fever"
        },
        prescription: {
          medications: [
            {
              medicationName: "Paracetamol",
              quantity: "9 tablets"
            },
            {
              medicationName: "Oral rehydration salts",
              quantity: "2 sachets"
            }
          ]
        }
      });

    expect(completeResponse.status).toBe(200);
    expect(completeResponse.body.visit.status).toBe("completed");
    expect(completeResponse.body.visit.assessmentOutcome).toBe("treated_by_nurse");
    expect(completeResponse.body.prescription.medicationName).toBe("Paracetamol");
    expect(completeResponse.body.prescriptions.map((item) => item.medicationName)).toContain("Oral rehydration salts");

    const profileResponse = await request(app)
      .get(`/api/patients/${patientResponse.body.patient.id}/profile`)
      .set("Authorization", `Bearer ${token}`);

    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.prescriptionHistory.map((item) => item.medicationName)).toContain("Paracetamol");
    expect(profileResponse.body.prescriptionHistory.map((item) => item.medicationName)).toContain("Oral rehydration salts");
    expect(profileResponse.body.medicineSafety.alerts.length).toBeGreaterThan(0);

    const doctorQueueResponse = await request(app)
      .get("/api/visits?status=awaiting_doctor_review")
      .set("Authorization", `Bearer ${token}`);

    expect(doctorQueueResponse.body.visits.map((visit) => visit.id)).not.toContain(startResponse.body.visit.id);
  });
});
