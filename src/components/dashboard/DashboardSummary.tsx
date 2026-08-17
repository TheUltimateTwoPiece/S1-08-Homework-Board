type DashboardSummaryProps = {
  dueTomorrow: number;
  assignmentsLeft: number;
  overdue: number;
  completed: number;
};

type SummaryTileProps = {
  label: string;
  value: number;
  tone: "blue" | "amber" | "rose" | "green";
};

const toneClasses: Record<SummaryTileProps["tone"], string> = {
  blue: "hb-dashboard-stat--blue",
  amber: "hb-dashboard-stat--amber",
  rose: "hb-dashboard-stat--rose",
  green: "hb-dashboard-stat--green",
};

function SummaryTile({ label, value, tone }: SummaryTileProps) {
  return (
    <div className={`hb-dashboard-stat ${toneClasses[tone]}`}>
      <p className="hb-dashboard-stat-label">{label}</p>
      <p className="hb-dashboard-stat-value" aria-label={`${value} ${label.toLowerCase()}`}>
        {value}
      </p>
    </div>
  );
}

export function DashboardSummary({
  dueTomorrow,
  assignmentsLeft,
  overdue,
  completed,
}: DashboardSummaryProps) {
  return (
    <section aria-label="Homework summary" className="hb-dashboard-summary">
      <SummaryTile label="Due tomorrow" value={dueTomorrow} tone="blue" />
      <SummaryTile label="Assignments left" value={assignmentsLeft} tone="amber" />
      <SummaryTile label="Overdue" value={overdue} tone="rose" />
      <SummaryTile label="Completed" value={completed} tone="green" />
    </section>
  );
}
