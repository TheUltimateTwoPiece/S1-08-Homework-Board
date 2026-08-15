import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { formatAppDate } from "@/lib/time";

type DashboardHeroProps = {
  firstName: string;
  todayDueCount: number;
  overdueCount: number;
  pipRemaining: number;
  isAdmin: boolean;
};

export function DashboardHero({
  firstName,
  todayDueCount,
  overdueCount,
  pipRemaining,
  isAdmin,
}: DashboardHeroProps) {
  return (
    <section className="hb-dashboard-hero">
      <div className="hb-dashboard-hero-content">
        <div className="hb-dashboard-kicker">
          <span className="hb-dashboard-kicker-dot" aria-hidden="true" />
          Your homework board
          <span className="hb-dashboard-date">· {formatAppDate(new Date(), { weekday: "long", month: "long", day: "numeric" })}</span>
        </div>
        <h1 className="hb-dashboard-hero-title">
          Hi, <span>{firstName}</span>!
          <span className="hb-dashboard-wave" aria-hidden="true">👋</span>
        </h1>
        <p className="hb-dashboard-hero-copy">
          A clear view of what is due, what is next, and how far you have come.
        </p>
        <div className="hb-dashboard-hero-signals" aria-label="Homework summary">
          <span className="hb-dashboard-signal hb-dashboard-signal--today">
            <span className="hb-dashboard-signal-icon" aria-hidden="true">◷</span>
            {todayDueCount === 0 ? "Nothing due today" : `${todayDueCount} due today`}
          </span>
          {overdueCount > 0 && (
            <span className="hb-dashboard-signal hb-dashboard-signal--overdue">
              <span className="hb-dashboard-signal-icon" aria-hidden="true">!</span>
              {overdueCount} overdue
            </span>
          )}
          <span className="hb-dashboard-signal hb-dashboard-signal--pip">
            <span className="hb-dashboard-signal-icon" aria-hidden="true">✦</span>
            {pipRemaining} Pip prompts left
          </span>
        </div>
      </div>

      <div className="hb-dashboard-hero-actions">
        <ThemeToggle />
        <Link href="/pip" className="hb-dashboard-hero-action hb-dashboard-hero-action--pip">
          <span className="hb-dashboard-action-glyph" aria-hidden="true">✦</span>
          <span>
            <strong>Ask Pip</strong>
            <small>Homework help</small>
          </span>
          <span aria-hidden="true">→</span>
        </Link>
        {isAdmin && (
          <Link href="/admin" className="hb-dashboard-hero-action hb-dashboard-hero-action--primary">
            <span className="hb-dashboard-action-glyph" aria-hidden="true">＋</span>
            <span>
              <strong>New post</strong>
              <small>Share homework</small>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
    </section>
  );
}
