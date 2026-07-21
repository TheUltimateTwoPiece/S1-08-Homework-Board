import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import type { Feedback } from "@/lib/types";

type FeedbackWidgetProps = { feedback: Feedback[]; };

export function FeedbackWidget({ feedback }: FeedbackWidgetProps) {
  const top = feedback.slice(0, 3);

  return (
    <section
      className="hb-bento-card hb-bento-card--clickable group relative bg-white dark:bg-slate-800"
      style={{ gridColumn: "span 6", gridRow: "span 1", animationDelay: "120ms" }}
    >
      <div className="hb-bento-head relative z-[1]">
        <div className="flex items-center gap-2">
          <div className="hb-bento-icon-box" style={{ background: "linear-gradient(135deg, rgba(217,119,6,0.18), rgba(217,119,6,0.04))", color: "#b45309" }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h2 className="hb-section-title text-sm tracking-tight">Feedback inbox</h2>
          {feedback.length > 0 && (
            <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-800/60 dark:text-amber-100">
              {feedback.length}
            </span>
          )}
        </div>
        <span className="rounded-md px-2 py-1 text-[11px] font-bold text-blue-700 transition group-hover:bg-blue-100 dark:text-blue-400 dark:group-hover:bg-blue-900/40">
          View all →
        </span>
      </div>

      {top.length === 0 ? (
        <div className="flex h-[calc(100%-44px)] items-center justify-center text-center">
          <p className="hb-section-title text-sm">No feedback yet</p>
        </div>
      ) : (
        <ul className="space-y-1.5 pb-5">
          {top.map((f, i) => (
            <li key={f.id} className="hb-snippet relative z-[3]" style={{ animationDelay: (140 + i * 50) + "ms" }}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-200 to-blue-100 text-xs font-bold text-blue-900 dark:from-blue-800/50 dark:to-blue-700/30 dark:text-blue-50">
                {(f.profiles?.full_name ?? "S").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <div className="hb-section-title line-clamp-1 text-sm">
                    {f.profiles?.full_name ?? "Student"}
                  </div>
                  <span className="hb-muted-text rounded bg-zinc-200 px-1 py-0.5 text-[10px] font-bold dark:bg-zinc-700">
                    {f.category}
                  </span>
                </div>
                <div className="hb-body-text line-clamp-1 text-xs">{f.message}</div>
                <div className="hb-muted-text text-[10px]">
                  {formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Link href="/admin/feedback" className="absolute inset-0 z-[1] rounded-[inherit]" tabIndex={-1} aria-hidden="true" aria-label="View all feedback" />
    </section>
  );
}
