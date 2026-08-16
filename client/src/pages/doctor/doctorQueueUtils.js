export const priorityRank = {
  immediate_escalation: 0,
  prompt_doctor_review: 1,
  routine_review: 2
};

export function statusLabel(visit) {
  return visit?.reviewPrompt?.label || "Routine Review";
}

export function sortDoctorLine(visits) {
  return [...visits].sort(
    (a, b) =>
      (priorityRank[a.reviewPrompt?.level] ?? 3) - (priorityRank[b.reviewPrompt?.level] ?? 3) ||
      String(a.submittedAt || a.updatedAt || a.createdAt).localeCompare(
        String(b.submittedAt || b.updatedAt || b.createdAt)
      )
  );
}

export function consolidateDoctorQueue(visits = []) {
  const grouped = new Map();

  for (const visit of visits) {
    const key = visit.patientId || visit.patientNumber || visit.patientName || visit.id;
    const current = grouped.get(key);
    const nextVisits = current ? [...current.relatedVisits, visit] : [visit];
    const sorted = sortDoctorLine(nextVisits);

    grouped.set(key, {
      ...sorted[0],
      relatedVisits: sorted,
      pendingVisitCount: sorted.length
    });
  }

  return sortDoctorLine([...grouped.values()]);
}
