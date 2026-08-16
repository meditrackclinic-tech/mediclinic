export const dashboardMockData = {
  admin: {
    kicker: "System overview",
    title: "Staff access and record readiness",
    description: "Static prototype analytics for administration, privacy review, and system preparedness.",
    metrics: [
      { label: "Staff accounts", value: "24", detail: "4 role groups", tone: "teal" },
      { label: "Active roles", value: "91%", detail: "Admin, reception, nurse, doctor", tone: "blue" },
      { label: "Patient records", value: "186", detail: "Selected clinic sample", tone: "gold" },
      { label: "Data completeness", value: "82%", detail: "Ready for review", tone: "green" }
    ],
    primaryChart: {
      title: "Staff Role Distribution",
      bars: [
        { label: "Nurses", value: 46 },
        { label: "Reception", value: 28 },
        { label: "Doctors", value: 34 },
        { label: "Admins", value: 20 }
      ]
    },
    secondaryChart: {
      title: "Record Completeness",
      segments: [
        { label: "Complete", value: 82 },
        { label: "Missing vitals", value: 11 },
        { label: "Needs review", value: 7 }
      ]
    },
    panels: [
      {
        title: "Privacy checks",
        items: ["No public patient login", "Role-based staff access", "Audit trail enabled"]
      },
      {
        title: "Audit alerts",
        items: ["2 inactive staff accounts", "5 new symptom records", "1 role change pending review"]
      },
      {
        title: "Prototype readiness",
        items: ["Static dashboard data loaded", "Vitals module available", "NLP output stored with raw text"]
      }
    ]
  },
  nurse: {
    kicker: "Intake overview",
    title: "Today’s patient intake flow",
    description: "Static operational view for front-desk clinical intake, vitals, and symptom capture.",
    metrics: [
      { label: "Waiting patients", value: "18", detail: "6 not yet triaged", tone: "teal" },
      { label: "Vitals recorded", value: "42", detail: "Today", tone: "green" },
      { label: "Symptom notes", value: "27", detail: "12 structured by NLP", tone: "blue" },
      { label: "Urgent review", value: "4", detail: "Needs doctor attention", tone: "gold" }
    ],
    primaryChart: {
      title: "Hourly Patient Load",
      bars: [
        { label: "08:00", value: 32 },
        { label: "10:00", value: 58 },
        { label: "12:00", value: 44 },
        { label: "14:00", value: 76 },
        { label: "16:00", value: 51 }
      ]
    },
    secondaryChart: {
      title: "Vitals Status",
      segments: [
        { label: "Normal", value: 64 },
        { label: "Watch", value: 24 },
        { label: "Escalate", value: 12 }
      ]
    },
    panels: [
      {
        title: "Needs vitals",
        items: ["N. Amadhila - waiting for BP", "M. Paulus - oxygen saturation", "E. Shilongo - temperature"]
      },
      {
        title: "Ready for doctor review",
        items: ["Chest pain, 3 days", "High fever, severe headache", "Shortness of breath"]
      },
      {
        title: "Clinical reminders",
        items: ["Record vitals before symptom capture", "Confirm patient identity", "Escalate severe symptoms promptly"]
      }
    ]
  },
  doctor: {
    kicker: "Clinical review",
    title: "Review queue and symptom intelligence",
    description: "Static review analytics for symptom patterns, timeline updates, and NLP confidence.",
    metrics: [
      { label: "Cases waiting", value: "14", detail: "6 new today", tone: "blue" },
      { label: "High severity", value: "5", detail: "Flagged mentions", tone: "gold" },
      { label: "Repeated symptoms", value: "9", detail: "Across visits", tone: "teal" },
      { label: "Timeline updates", value: "21", detail: "Last 24 hours", tone: "green" }
    ],
    primaryChart: {
      title: "Symptom Categories",
      bars: [
        { label: "Respiratory", value: 72 },
        { label: "Pain", value: 64 },
        { label: "Fever", value: 48 },
        { label: "Digestive", value: 31 }
      ]
    },
    secondaryChart: {
      title: "NLP Confidence",
      segments: [
        { label: "High", value: 71 },
        { label: "Medium", value: 22 },
        { label: "Needs check", value: 7 }
      ]
    },
    panels: [
      {
        title: "Review first",
        items: ["Severe chest pain with shortness of breath", "Persistent fever over 5 days", "Repeated dizziness"]
      },
      {
        title: "Timeline changes",
        items: ["Cough duration extended", "Pain severity increased", "Vitals added after intake"]
      },
      {
        title: "Follow-up flags",
        items: ["Confirm severity terms", "Compare with previous visits", "Review raw patient text before action"]
      }
    ]
  }
};
