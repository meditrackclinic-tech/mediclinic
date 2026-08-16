import { FileSearch } from "lucide-react";

export function EmptyState({ title, text }) {
  return (
    <div className="empty-state">
      <FileSearch size={22} />
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}
