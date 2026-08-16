import { ArrowRight } from "lucide-react";

/* Photographs — pinned to the page like snapshots on a clinic notice board. */
const PHOTOS = {
  chip: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1e?auto=format&fit=crop&w=480&h=300&q=80",
  reception:
    "https://images.unsplash.com/photo-1666886573421-d19e546cfc4e?auto=format&fit=crop&w=800&h=600&q=80",
  nurse:
    "https://images.unsplash.com/photo-1584982751601-97dcc096659c?auto=format&fit=crop&w=800&h=600&q=80",
  corridor:
    "https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=800&h=600&q=80"
};

function hideOnError(event) {
  event.currentTarget.style.visibility = "hidden";
}

const snapshots = [
  { img: PHOTOS.reception, tilt: "lz-tilt-a", n: "01", caption: "The front desk finds their record" },
  { img: PHOTOS.nurse, tilt: "lz-tilt-b", n: "02", caption: "The nurse writes it down" },
  { img: PHOTOS.corridor, tilt: "lz-tilt-c", n: "03", caption: "The doctor reads the whole story" }
];

export function HomePage({ onLoginClick }) {
  return (
    <div className="lz">
      <header className="lz-nav">
        <span className="lz-wordmark">
          MediTrack <em>NLP</em>
        </span>
        <span className="lz-nav-place">Khomas Region · Namibia</span>
        <button className="lz-nav-login" onClick={onLoginClick} type="button">
          Staff sign in
          <ArrowRight size={15} />
        </button>
      </header>

      <main className="lz-hero">
        <h1 className="lz-headline">
          Every patient arrives with a{" "}
          <span className="lz-chip">
            <img src={PHOTOS.chip} alt="" onError={hideOnError} />
          </span>{" "}
          <em>story.</em>
        </h1>

        <p className="lz-sub">
          This system keeps it — word for word — and quietly turns it into a record
          clinicians can use.
        </p>

        {/* The concept: a patient's sentence, annotated the way the NLP reads it. */}
        <figure className="lz-card">
          <span className="lz-card-stamp">VISIT — 03 · 14:20</span>
          <blockquote>
            “I've been{" "}
            <span className="lz-mk lz-mk-symptom">
              coughing<i>symptom</i>
            </span>{" "}
            for{" "}
            <span className="lz-mk lz-mk-duration">
              three days<i>duration</i>
            </span>{" "}
            and it gets{" "}
            <span className="lz-mk lz-mk-severity">
              worse<i>severity</i>
            </span>{" "}
            <span className="lz-mk lz-mk-pattern">
              at night<i>pattern</i>
            </span>
            .”
          </blockquote>
          <figcaption>— kept exactly as the patient said it</figcaption>
        </figure>

        <div className="lz-cta-row">
          <button className="lz-cta" onClick={onLoginClick} type="button">
            Enter staff workspace
            <ArrowRight size={17} />
          </button>
          <span className="lz-cta-note">Staff access only · records, not diagnosis</span>
        </div>
      </main>

      <section className="lz-board" aria-label="How a visit moves through the clinic">
        {snapshots.map((s) => (
          <figure className={`lz-polaroid ${s.tilt}`} key={s.n}>
            <img src={s.img} alt={s.caption} onError={hideOnError} />
            <figcaption>
              <b>{s.n}</b>
              {s.caption}
            </figcaption>
          </figure>
        ))}
      </section>

      <footer className="lz-foot">
        <span className="lz-wordmark lz-wordmark-sm">
          MediTrack <em>NLP</em>
        </span>
        <p>
          An academic prototype for selected public and private clinics in the Khomas Region,
          Namibia. It keeps records — it never diagnoses.
        </p>
      </footer>
    </div>
  );
}
