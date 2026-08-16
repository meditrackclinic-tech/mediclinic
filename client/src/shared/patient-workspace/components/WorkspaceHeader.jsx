import {
  ClipboardList,
  Database,
  FileClock,
  HeartPulse,
  RefreshCcw,
  Search,
  UsersRound
} from "lucide-react";

export function WorkspaceHeader({ heading, description, search, onSearchChange, summary, onRefresh }) {
  return (
    <header className="workspace-header">
      <div>
        <span className="workspace-kicker">
          <ClipboardList size={14} />
          Clinical workflow
        </span>
        <h2>{heading}</h2>
        <p>{description}</p>
      </div>
      <div className="header-tools">
        <div className="mini-metrics">
          <span>
            <UsersRound size={15} />
            {summary?.totals.patients || 0} patients
          </span>
          <span>
            <FileClock size={15} />
            {summary?.totals.symptomRecords || 0} records
          </span>
          <span>
            <HeartPulse size={15} />
            {summary?.totals.vitals || 0} vitals
          </span>
          <span>
            <Database size={15} />
            NLP store
          </span>
        </div>
        <div className="search-box">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search patients"
          />
        </div>
        {onRefresh ? (
          <button className="secondary action-small nurse-refresh-mini" onClick={onRefresh} type="button">
            <RefreshCcw size={16} />
            Refresh
          </button>
        ) : null}
      </div>
    </header>
  );
}
