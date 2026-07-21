import Link from "next/link";
import { format, isPast, parseISO } from "date-fns";
import { PostCompleteButton } from "@/components/PostCompleteButton";
import { togglePostComplete } from "@/actions/completions";
import type { Post } from "@/lib/types";

type PostsWidgetProps = {
  posts: Post[];
  completedSet: Set<string>;
  firstName: string;
};

function formatDueLabel(due: string | null) {
  if (!due) return null;
  const date = parseISO(due);
  if (isPast(date) && due < format(new Date(), "yyyy-MM-dd")) {
    return { text: "Overdue", className: "text-rose-700 dark:text-rose-300" };
  }
  const today = format(new Date(), "yyyy-MM-dd");
  if (due === today) return { text: "Due today", className: "text-amber-700 dark:text-amber-300" };
  return { text: "Due " + format(date, "MMM d"), className: "hb-card-meta" };
}

export function PostsWidget({ posts, completedSet, firstName }: PostsWidgetProps) {
  const top = posts.slice(0, 7);
  const totalDone = top.filter((p) => completedSet.has(p.id)).length;

  return (
    <section
      className="hb-bento-card hb-bento-card--clickable group relative "
      style={{ gridColumn: "span 7", gridRow: "span 2", animationDelay: "60ms" }}
    >
      <div className="hb-bento-head relative z-[1]">
        <div className="flex items-center gap-3">
          <div className="hb-bento-icon-box">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 1 4 19.5" />
              <path d="M9 10h6" />
              <path d="M9 14h6" />
            </svg>
          </div>
          <div>
            <h2 className="hb-card-section text-base tracking-tight">{firstName}&apos;s homework</h2>
            <p className="hb-card-body text-xs font-semibold">{totalDone} of {top.length} done · tap to open</p>
          </div>
        </div>
        <span className="rounded-md px-2.5 py-1.5 text-xs font-bold text-blue-700 transition group-hover:bg-blue-100 dark:text-blue-400 dark:group-hover:bg-blue-900/40">
          View all →
        </span>
      </div>

      {top.length === 0 ? (
        <div className="flex h-[calc(100%-56px)] flex-col items-center justify-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-700">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="hb-card-meta h-6 w-6" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <p className="hb-card-section text-sm">All caught up!</p>
          <p className="hb-card-meta text-xs">No homework waiting for you.</p>
        </div>
      ) : (
        <ul className="-mx-2 max-h-[calc(100%-56px)] space-y-1 overflow-y-auto pb-6">
          {top.map((post, i) => {
            const done = completedSet.has(post.id);
            const due = formatDueLabel(post.due_at);
            const rowClass = done ? "hb-posts-widget-row--done" : post.pinned ? "hb-posts-widget-row--pinned" : "hb-posts-widget-row--todo";
            return (
              <li key={post.id} className={"hb-posts-widget-row " + rowClass} style={{ animationDelay: (100 + i * 50) + "ms" }}>
                <form action={togglePostComplete} className="hb-posts-widget-check relative z-[3]">
                  <input type="hidden" name="postId" value={post.id} />
                  <PostCompleteButton completed={done} compact />
                </form>
                <Link href={"/posts/" + post.id} className="min-w-0 flex-1 relative z-[3]">
                  <div className="flex items-center gap-2">
                    {post.pinned && <span aria-hidden="true" className="text-amber-600">📌</span>}
                    <span className={"hb-card-section truncate text-sm " + (done ? "hb-card-faded line-through" : "")}>{post.title}</span>
                    <span className="hb-badge-subject shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold">{post.subject}</span>
                  </div>
                  {due && <div className={"mt-0.5 text-[11px] font-bold " + due.className}>{due.text}</div>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Link href="/posts" className="absolute inset-0 z-[1] rounded-[inherit]" tabIndex={-1} aria-hidden="true" aria-label="View all homework" />
    </section>
  );
}
