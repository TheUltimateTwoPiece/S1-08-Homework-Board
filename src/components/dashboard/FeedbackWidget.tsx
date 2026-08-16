import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Avatar } from "@/components/Avatar";
import type { Feedback } from "@/lib/types";

type FeedbackWidgetProps = { feedback: Feedback[] };

export function FeedbackWidget({ feedback }: FeedbackWidgetProps) {
  const top = feedback.slice(0, 3);

  return (
    <section aria-labelledby="feedback-heading" className="hb-card-surface p-5 sm:p-6">
      <header className="mb-4 flex items-baseline justify-between gap-4 border-b pb-3">
        <div>
          <h2 id="feedback-heading" className="hb-card-section text-sm">
            Feedback
          </h2>
          <p className="hb-card-meta mt-0.5 text-xs">
            {feedback.length === 0
              ? "Nothing submitted yet"
              : `${feedback.length} total`}
          </p>
        </div>
        <Link
          href="/admin/feedback"
          className="shrink-0 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Inbox
        </Link>
      </header>

      {top.length === 0 ? (
        <p className="hb-card-meta text-sm">No feedback yet.</p>
      ) : (
        <ul className="divide-y">
          {top.map((f) => (
            <li key={f.id} className="flex items-start gap-3 py-2.5">
              <Avatar
                id={f.author_id}
                name={f.profiles?.full_name ?? "Student"}
                src={f.profiles?.avatar_url ?? null}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-baseline gap-2">
                  <p className="hb-card-section truncate text-sm">
                    {f.profiles?.full_name ?? "Student"}
                  </p>
                  <span className="hb-card-meta shrink-0 text-xs">
                    {f.category}
                  </span>
                </div>
                <p className="hb-card-body truncate text-sm">{f.message}</p>
                <p className="hb-card-meta mt-0.5 text-xs">
                  {formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
