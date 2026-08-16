import { Activity, BarChart3, ClipboardCheck, ShieldCheck } from "lucide-react";
import { dashboardMockData } from "../../data/dashboardMockData.js";

const iconByIndex = [BarChart3, Activity, ShieldCheck, ClipboardCheck];

export function StaffDashboardOverview({ role }) {
  const data = dashboardMockData[role];
  const maxBarValue = Math.max(...data.primaryChart.bars.map((item) => item.value), 1);

  return (
    <section className="staff-dashboard page-stack">
      <section className="panel staff-overview-hero">
        <div>
          <span className="section-label">{data.kicker}</span>
          <h3>{data.title}</h3>
          <p>{data.description}</p>
        </div>
        <div className="staff-metric-grid">
          {data.metrics.map((metric, index) => {
            const Icon = iconByIndex[index] || BarChart3;

            return (
              <article className={`staff-metric-card tone-${metric.tone}`} key={metric.label}>
                <Icon size={19} />
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <p>{metric.detail}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="staff-visual-grid">
        <article className="panel staff-chart-card">
          <div className="staff-card-heading">
            <span>Visualization</span>
            <strong>{data.primaryChart.title}</strong>
          </div>
          <div className="staff-bar-chart">
            {data.primaryChart.bars.map((item) => (
              <div className="staff-bar-row" key={item.label}>
                <span>{item.label}</span>
                <div>
                  <i style={{ width: `${Math.max((item.value / maxBarValue) * 100, 8)}%` }} />
                </div>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="panel staff-chart-card">
          <div className="staff-card-heading">
            <span>Quality view</span>
            <strong>{data.secondaryChart.title}</strong>
          </div>
          <div className="staff-segment-list">
            {data.secondaryChart.segments.map((segment) => (
              <div className="staff-segment-row" key={segment.label}>
                <div>
                  <span>{segment.label}</span>
                  <strong>{segment.value}%</strong>
                </div>
                <progress value={segment.value} max="100" />
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="staff-panel-grid">
        {data.panels.map((panel) => (
          <article className="panel staff-action-panel" key={panel.title}>
            <div className="staff-card-heading">
              <span>Relevant work</span>
              <strong>{panel.title}</strong>
            </div>
            <ul>
              {panel.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </section>
  );
}
