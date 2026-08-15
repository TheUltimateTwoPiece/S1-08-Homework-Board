import Link from "next/link";
import type { ReactNode } from "react";

type DashboardMetricsProps = {
  dueTomorrowCount: number;
  remainingCount: number;
  overdueCount: number;
  completedCount: number;
};

type MetricCardProps = {
  href: string;
  eyebrow: string;
  value: number;
  label: string;
  tone: "blue" | "violet" | "rose" | "green";
  icon: ReactNode;
};

function MetricCard({ href, eyebrow, value, label, tone, icon }: MetricCardProps) {
  return (
    <Link href={href} className={`hb-dashboard-metric hb-dashboard-metric--${tone}`}>
      <div className="hb-dashboard-metric-top">
        <span className="hb-dashboard-metric-eyebrow">{eyebrow}</span>
        <span className="hb-dashboard-metric-icon" aria-hidden="true">{icon}</span>
      </div>
      <div className="hb-dashboard-metric-value">{value}</div>
      <div className="hb-dashboard-metric-label">{label}</div>
      <span className="hb-dashboard-metric-arrow" aria-hidden="true">↗</span>
    </Link>
  );
}

export function DashboardMetrics({
  dueTomorrowCount,
  remainingCount,
  overdueCount,
  completedCount,
}: DashboardMetricsProps) {
  return (
    <section className="hb-dashboard-metrics" aria-label="Homework overview">
      <MetricCard
        href="/posts?due=tomorrow&status=todo"
        eyebrow="Due tomorrow"
        value={dueTomorrowCount}
        label={dueTomorrowCount === 1 ? "assignment to plan for" : "assignments to plan for"}
        tone="blue"
        icon={<span>◷</span>}
      />
      <MetricCard
        href="/posts?status=todo"
        eyebrow="Assignments left"
        value={remainingCount}
        label="still on your list"
        tone="violet"
        icon={<span>☰</span>}
      />
      <MetricCard
        href="/posts?due=overdue&status=todo"
        eyebrow="Overdue"
        value={overdueCount}
        label={overdueCount === 0 ? "you are all caught up" : "need your attention"}
        tone="rose"
        icon={<span>!</span>}
      />
      <MetricCard
        href="/posts?status=completed"
        eyebrow="Completed"
        value={completedCount}
        label={completedCount === 1 ? "assignment finished" : "assignments finished"}
        tone="green"
        icon={<span>✓</span>}
      />
    </section>
  );
}
