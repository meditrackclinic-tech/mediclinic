import { NursePatientsPage } from "./NursePatientsPage.jsx";

export function NursePatientRecordsPage({ user }) {
  // Records use the same clean nurse portal layout as Assess Patient.
  return <NursePatientsPage mode="records" user={user} />;
}
