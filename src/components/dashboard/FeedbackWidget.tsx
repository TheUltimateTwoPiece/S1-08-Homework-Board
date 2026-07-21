import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import type { Feedback } from "@/lib/types";

type FeedbackWidgetProps = {
  feedback: Feedback[];
};

export function FeedbackWidget({ feedback }: FeedbackWidgetProps) {
  const top = feedback.slice(0, 3);

  return (
    <section
      className="hb-bento-card"
      style={{ gridColumn: "span 6", gridRow: "span 1", animationDelay: "120ms" }}
    >
      <div className="hb-bento-head">
        <div className="flex items-center gap-2">
          <div className="hb-bento-icon-box" style={{ background: "linear-gradient(135deg, rgba(217,119,6,0.18), rgba(217,119,6,0.04))", color: "var(--hb-warning)" }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Feedback inbox
          </h2>
          {feedback.length > 0 && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              {feedback.length}
            </span>
          )}
        </div>
        <Link
          href="/admin/feedback"
          className="text-[11px] font-semibold text-blue-600 transition hover:text-blue-700 dark:text-blue-400"
        >
          View all →
        </Link>
      </div>
      {top.length === 0 ? (
        <div className="flex h-[calc(100%-44px)] items-center justify-center text-center">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            No feedback yet
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {top.map((f, i) => (
            <li
              key={f.id}
              className="hb-snippet"
              style={{ animationDelay: `${140 + i * 50}ms` }}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-blue-50 text-xs font-bold text-blue-700 dark:from-blue-900/50 dark:to-blue-800/30 dark:text-blue-300">
                {(f.profiles?.full_name ?? "S").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                  {f.profiles?.full_name ?? "Student"}
                  <span className="ml-1.5 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300 dark:bg-slate-700 dark:text-slate-300">
                    {f.category}
                  </span>
                </div>
                <div className="line-clamp-1 text-xs text-slate-700 dark:text-slate-300">
                  {f.message}
                </div>
                <div className="text-[10px] text-slate-600 dark:text-slate-200">
                  {formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
