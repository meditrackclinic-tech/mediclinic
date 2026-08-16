export function PlaceholderPage({ title, description, items = [] }) {
  return (
    <section className="panel placeholder-page">
      <h3>{title}</h3>
      <p className="muted">{description}</p>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
