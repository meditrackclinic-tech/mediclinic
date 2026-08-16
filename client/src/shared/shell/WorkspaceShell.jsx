import {
  Activity,
  BarChart3,
  BrainCircuit,
  ClipboardList,
  FileSearch,
  GitBranchPlus,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  KeyRound,
  ScrollText,
  ShieldCheck,
  Stethoscope,
  UserCog,
  UserPlus,
  Users
} from "lucide-react";
import namibiaCoatOfArms from "../../assets/namibia-coat-of-arms.svg";

const roleAliases = {
  admin: "admin",
  doctor: "doctor",
  clinician: "doctor",
  receptionist: "receptionist",
  nurse: "nurse",
  staff: "nurse"
};

const roleSidebar = {
  admin: {
    title: "Admin",
    eyebrow: "System control",
    tagline: "Manage users, reports, audit logs",
    icon: UserCog,
    focus: "Staff access and system activity",
    nav: [
      { id: "overview", icon: LayoutDashboard, label: "Dashboard" },
      { id: "users", icon: Users, label: "Users" },
      { id: "reports", icon: BarChart3, label: "Reports" },
      { id: "audit", icon: ScrollText, label: "Audit" }
    ]
  },
  receptionist: {
    title: "Receptionist",
    eyebrow: "Front desk",
    tagline: "Patient records and arrivals",
    icon: Users,
    focus: "Find an existing patient or create the one permanent patient record before nurse assessment",
    nav: [
      { id: "overview", icon: LayoutDashboard, label: "Dashboard" },
      { id: "patients", icon: UserPlus, label: "Patient Records" }
    ]
  },
  nurse: {
    title: "Nurse",
    eyebrow: "Assessment workspace",
    tagline: "Quick assessment and patient records",
    icon: ClipboardList,
    focus: "Search existing patients, record vitals, capture complaint, use NLP, then treat or send to doctor",
    nav: [
      { id: "overview", icon: LayoutDashboard, label: "Dashboard" },
      { id: "assess", icon: HeartPulse, label: "Quick Assessment" },
      { id: "records", icon: FileSearch, label: "Patient Records" }
    ]
  },
  doctor: {
    title: "Doctor",
    eyebrow: "Clinical review",
    tagline: "Review symptoms and timelines",
    icon: Stethoscope,
    focus: "Structured symptoms, history, and clinical review",
    nav: [
      { id: "overview", icon: LayoutDashboard, label: "Dashboard" },
      { id: "review", icon: FileSearch, label: "Review" },
      { id: "timeline", icon: Activity, label: "Timeline" },
      { id: "continuity", icon: GitBranchPlus, label: "Continuity" },
      { id: "reports", icon: BarChart3, label: "Reports" }
    ]
  }
};

export function WorkspaceShell({
  user,
  onLogout,
  title,
  activeTab = "overview",
  onNavigate = () => {},
  children
}) {
  const role = roleAliases[user.role] || "nurse";
  const sidebar = roleSidebar[role];
  const BrandIcon = sidebar.icon;
  const activeItem = sidebar.nav.find((item) => item.id === activeTab) || sidebar.nav[0];

  if (["nurse", "admin", "doctor", "receptionist"].includes(role)) {
    const portalName = {
      admin: "Clinical Records Administration",
      receptionist: "Patient Registration",
      nurse: "Digital Patient Assessment",
      doctor: "Clinical Review and Continuity"
    }[role];

    return (
      <main className={`nurse-system-shell ${role}-system-shell role-theme-${role}`}>
        <aside className="nurse-system-sidebar">
          <div className="nurse-system-seal">
            <img src={namibiaCoatOfArms} alt="Republic of Namibia coat of arms" />
            <div>
              <span>Ministry clinic portal</span>
              <strong>{portalName}</strong>
            </div>
          </div>

          <div className="nurse-system-brand">
            <span>{sidebar.eyebrow}</span>
            <h1>{sidebar.title}</h1>
            <p>{sidebar.tagline}</p>
          </div>

          <nav className="nurse-system-nav" aria-label={`${sidebar.title} navigation`}>
            {sidebar.nav.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === activeTab;

              return (
                <button
                  aria-current={isActive ? "page" : undefined}
                  className={isActive ? "nurse-system-nav-item active" : "nurse-system-nav-item"}
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  type="button"
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="nurse-system-context">
            <BrainCircuit size={18} />
            <div>
              <strong>{activeItem.label}</strong>
              <p>{sidebar.focus}</p>
            </div>
          </div>

          <button className="nurse-system-signout" onClick={onLogout} type="button">
            <LogOut size={18} />
            Sign out
          </button>
        </aside>

        <section className="nurse-system-main page-transition" key={`${role}-${activeTab}`}>
          <header className="nurse-system-topbar">
            <div className="nurse-system-topbar-title">
              <img src={namibiaCoatOfArms} alt="Republic of Namibia coat of arms" />
              <div>
                <span>Republic of Namibia clinic record system</span>
                <strong>{title}</strong>
              </div>
            </div>

            <div className="nurse-system-topbar-actions">
              <span>{user.name || user.email}</span>
              <button
                className={activeTab === "security" ? "active" : ""}
                onClick={() => onNavigate("security")}
                type="button"
              >
                <KeyRound size={16} />
                Security
              </button>
            </div>
          </header>

          {children}
        </section>
      </main>
    );
  }

  return (
    <main className={`app-shell role-theme-${role}`}>
      <aside className={`sidebar role-sidebar role-sidebar-${role}`}>
        {role === "nurse" ? (
          <div className="nurse-official-seal">
            <img src={namibiaCoatOfArms} alt="Republic of Namibia coat of arms" />
            <div>
              <span>Ministry clinic portal</span>
              <strong>Digital Patient Assessment</strong>
            </div>
          </div>
        ) : null}

        <div className="brand-row role-brand">
          <span className="brand-mark">
            <BrandIcon size={23} />
          </span>
          <div>
            <span>{sidebar.eyebrow}</span>
            <h1>{sidebar.title}</h1>
            <p>{sidebar.tagline}</p>
          </div>
        </div>

        <nav className="sidebar-nav compact-sidebar-nav" aria-label={`${sidebar.title} navigation`}>
          {sidebar.nav.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activeTab;

            return (
              <button
                aria-current={isActive ? "page" : undefined}
                className={isActive ? "side-nav-item active" : "side-nav-item"}
                key={item.id}
                onClick={() => onNavigate(item.id)}
                type="button"
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="side-intel compact-intel">
          <BrainCircuit size={18} />
          <div>
            <strong>{activeItem.label}</strong>
            <p>{sidebar.focus}</p>
          </div>
        </div>

        <button className="secondary sign-out-button" onClick={onLogout} type="button">
          <LogOut size={18} />
          Sign out
        </button>
      </aside>

      <section className="workspace page-transition" key={`${role}-${activeTab}`}>
        <header className="app-topbar">
          <div className="topbar-title-block">
            {role === "nurse" ? (
              <img className="national-emblem" src={namibiaCoatOfArms} alt="Republic of Namibia coat of arms" />
            ) : null}
            <div>
              <span>{role === "nurse" ? "Republic of Namibia clinic record system" : "Patient symptom record management"}</span>
              <strong>{title}</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <span className="system-pill">
              <ShieldCheck size={15} />
              Staff system
            </span>
            <span className="topbar-user-chip">
              <span>{user.name?.slice(0, 1) || "U"}</span>
              {user.name || user.email}
            </span>
            <button
              className={activeTab === "security" ? "security-topbar-button active" : "security-topbar-button"}
              onClick={() => onNavigate("security")}
              type="button"
            >
              <KeyRound size={16} />
              Security
            </button>
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}
