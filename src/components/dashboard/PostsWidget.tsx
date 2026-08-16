import Link from "next/link";
import { format, parseISO } from "date-fns";
import { PostCompleteButton } from "@/components/PostCompleteButton";
import { togglePostComplete } from "@/actions/completions";
import type { Post } from "@/lib/types";
import { getTodayString } from "@/lib/time";

type PostsWidgetProps = {
  posts: Post[];
  completedSet: Set<string>;
};

function dueLabelFor(due: string | null) {
  const today = getTodayString();
  if (!due) return { text: "No due date", className: "hb-card-meta" };
  if (due < today) {
    return { text: "Overdue", className: "text-rose-600 dark:text-rose-400" };
  }
  if (due === today) {
    return { text: "Due today", className: "text-amber-600 dark:text-amber-400" };
  }
  return {
    text: format(parseISO(due), "EEE, d MMM"),
    className: "hb-card-meta",
  };
}

export function PostsWidget({ posts, completedSet }: PostsWidgetProps) {
  const shown = posts.slice(0, 9);
  const totalDone = shown.filter((p) => completedSet.has(p.id)).length;
  const overdue = shown.filter(
    (p) => p.due_at && p.due_at < getTodayString() && !completedSet.has(p.id),
  ).length;
  const dueToday = shown.filter(
    (p) => p.due_at === getTodayString() && !completedSet.has(p.id),
  ).length;

  const summary =
    shown.length === 0
      ? "No homework posted yet"
      : `${totalDone} of ${shown.length} done` +
        (overdue > 0 ? ` · ${overdue} overdue` : "") +
        (dueToday > 0 ? ` · ${dueToday} due today` : "");

  return (
    <section
      aria-labelledby="homework-heading"
      className="hb-card-surface p-5 sm:p-6"
    >
      <header className="mb-1 flex items-baseline justify-between gap-4 border-b pb-3">
        <div className="min-w-0">
          <h2
            id="homework-heading"
            className="hb-card-title text-lg leading-snug"
          >
            Homework
          </h2>
          <p className="hb-card-meta mt-0.5 truncate text-sm">{summary}</p>
        </div>
        <Link
          href="/posts"
          className="shrink-0 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          View all
        </Link>
      </header>

      {shown.length === 0 ? (
        <div className="py-10 text-center">
          <p className="hb-card-section text-sm">Nothing here yet</p>
          <p className="hb-card-meta mt-1 text-sm">
            New homework will show up here as soon as it’s posted.
          </p>
        </div>
      ) : (
        <ul className="divide-y">
          {shown.map((post) => {
            const done = completedSet.has(post.id);
            const due = dueLabelFor(post.due_at);
            const subjects = Array.isArray(post.subject) ? post.subject : [];
            const subjectLabel =
              subjects.length > 2
                ? subjects.slice(0, 2).join(", ") + ` +${subjects.length - 2}`
                : subjects.join(", ");
            return (
              <li key={post.id}>
                <div className="flex items-center gap-3 py-2.5">
                  <form
                    action={togglePostComplete}
                    className="flex shrink-0 items-center"
                  >
                    <input type="hidden" name="postId" value={post.id} />
                    <input
                      type="hidden"
                      name="completed"
                      value={done ? "false" : "true"}
                    />
                    <PostCompleteButton completed={done} compact />
                  </form>

                  <Link
                    href={"/posts/" + post.id}
                    className="min-w-0 flex-1"
                  >
                    <div className="flex min-w-0 items-baseline gap-2">
                      <span
                        className={
                          "hb-card-section truncate text-sm " +
                          (done ? "hb-card-faded line-through" : "")
                        }
                      >
                        {post.title}
                      </span>
                      {subjectLabel && (
                        <span className="hb-card-meta hidden shrink-0 text-xs sm:inline">
                          {subjectLabel}
                        </span>
                      )}
                    </div>
                    <div className={"mt-0.5 text-xs font-medium " + due.className}>
                      {due.text}
                      {post.pinned ? " · pinned" : ""}
                    </div>
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
