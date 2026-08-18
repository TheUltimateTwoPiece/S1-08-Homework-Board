type DashboardSummaryProps = {
  dueToday: number;
  dueTomorrow: number;
  assignmentsLeft: number;
  overdue: number;
  completed: number;
};

type SummaryTileProps = {
  label: string;
  value: number;
  mobileLabel?: string;
  mobileValue?: number;
  tone: "blue" | "amber" | "rose" | "green";
};

const toneClasses: Record<SummaryTileProps["tone"], string> = {
  blue: "hb-dashboard-stat--blue",
  amber: "hb-dashboard-stat--amber",
  rose: "hb-dashboard-stat--rose",
  green: "hb-dashboard-stat--green",
};

function SummaryTile({ label, value, mobileLabel, mobileValue, tone }: SummaryTileProps) {
  const shownMobileValue = mobileValue ?? value;
  const shownMobileLabel = mobileLabel ?? label;
  return (
    <div className={`hb-dashboard-stat ${toneClasses[tone]}`}>
      <p className="hb-dashboard-stat-label">
        <span className="hb-dashboard-stat-desktop-label">{label}</span>
        <span className="hb-dashboard-stat-mobile-label">{shownMobileLabel}</span>
      </p>
      <p className="hb-dashboard-stat-value">
        <span className="hb-dashboard-stat-desktop-value">{value}</span>
        <span className="hb-dashboard-stat-mobile-value">{shownMobileValue}</span>
      </p>
    </div>
  );
}

export function DashboardSummary({
  dueToday,
  dueTomorrow,
  assignmentsLeft,
  overdue,
  completed,
}: DashboardSummaryProps) {
  return (
    <section aria-label="Homework summary" className="hb-dashboard-summary">
      <SummaryTile
        label="Due tomorrow"
        value={dueTomorrow}
        mobileLabel="Due today"
        mobileValue={dueToday}
        tone="blue"
      />
      <SummaryTile label="Assignments left" value={assignmentsLeft} tone="amber" />
      <SummaryTile label="Overdue" value={overdue} tone="rose" />
      <SummaryTile label="Completed" value={completed} tone="green" />
    </section>
  );
}
