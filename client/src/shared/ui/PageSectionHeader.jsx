export function PageSectionHeader({ label, title, description }) {
  return (
    <div className="section-header">
      {label ? <span>{label}</span> : null}
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
