import { ClipboardList, Search, UserPlus, UsersRound } from "lucide-react";

const arrivalSteps = [
  { title: "Patient arrives", note: "Greet and confirm identity at the front desk." },
  { title: "Search the record", note: "Look for an existing patient before anything else." },
  { title: "Create only if missing", note: "One permanent record per patient — no duplicates." },
  { title: "Send to the nurse", note: "The nurse opens Quick Assessment on that record." }
];

export function ReceptionistOverviewPage({ onNavigate = () => {} }) {
  return (
    <section className="page-stack">
      <header className="pg-head">
        <div>
          <span className="pg-kicker">Front desk</span>
          <h2>One record before clinical work starts</h2>
          <p className="pg-sub">
            Reception prepares the permanent patient identity record so the nurse can start the
            assessment without filling registration forms.
          </p>
        </div>
        <div className="pg-actions">
          <button onClick={() => onNavigate("patients")} type="button">
            <Search size={16} />
            Find or create patient
          </button>
        </div>
      </header>

      <div className="step-strip" aria-label="Arrival workflow">
        {arrivalSteps.map((step, index) => (
          <article key={step.title}>
            <span>{index + 1}</span>
            <div>
              <strong>{step.title}</strong>
              <small>{step.note}</small>
            </div>
          </article>
        ))}
      </div>

      <article className="panel">
        <div className="ph-card-head">
          <strong>Why reception goes first</strong>
          <span>identity before treatment</span>
        </div>
        <div className="note-row">
          <UsersRound size={16} />
          <span>
            <strong>Patient identity</strong>
            Prevent duplicate records before the nurse starts vitals and complaint capture.
          </span>
        </div>
        <div className="note-row">
          <UserPlus size={16} />
          <span>
            <strong>One long-term record</strong>
            Future digital patient passport features can link to the same record later.
          </span>
        </div>
        <div className="note-row">
          <ClipboardList size={16} />
          <span>
            <strong>The nurse receives a ready profile</strong>
            Quick Assessment opens on the record instead of a registration form.
          </span>
        </div>
      </article>
    </section>
  );
}
