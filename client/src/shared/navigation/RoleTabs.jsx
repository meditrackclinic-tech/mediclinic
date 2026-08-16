export function RoleTabs({ tabs, activeTab, onChange }) {
  return (
    <nav className="role-tabs" aria-label="Role pages">
      {tabs.map((tab) => (
        <button
          className={activeTab === tab.id ? "tab-button active" : "tab-button"}
          key={tab.id}
          onClick={() => onChange(tab.id)}
          type="button"
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
