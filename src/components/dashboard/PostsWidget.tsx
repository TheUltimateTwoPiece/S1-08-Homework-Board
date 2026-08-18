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
    return { text: "Today", className: "text-amber-600 dark:text-amber-400" };
  }
  return { text: format(parseISO(due), "d MMM"), className: "hb-card-meta" };
}

export function PostsWidget({ posts, completedSet }: PostsWidgetProps) {
  const todoPosts = posts.filter((post) => !completedSet.has(post.id));
  const shown = (todoPosts.length > 0 ? todoPosts : posts).slice(0, 8);
  const completedCount = posts.length - todoPosts.length;

  return (
    <section
      aria-labelledby="upcoming-assignments-heading"
      className="hb-card-surface p-5 sm:p-6"
    >
      <header className="mb-1 flex items-baseline justify-between gap-4 border-b pb-3">
        <div className="min-w-0">
          <h2
            id="upcoming-assignments-heading"
            className="hb-card-title text-lg leading-snug"
          >
            Upcoming assignments
          </h2>
          <p className="hb-card-meta mt-0.5 truncate text-sm">
            {todoPosts.length > 0
              ? `${todoPosts.length} assignment${todoPosts.length === 1 ? "" : "s"} left`
              : completedCount > 0
                ? "Everything is marked complete"
                : "No homework posted yet"}
          </p>
        </div>
        <Link
          href="/posts"
          className="shrink-0 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          View all
        </Link>
      </header>

      {shown.length === 0 ? (
        <div className="py-12 text-center">
          <p className="hb-card-section text-sm">Nothing here yet</p>
          <p className="hb-card-meta mt-1 text-sm">
            New homework will show up here as soon as it's posted.
          </p>
        </div>
      ) : (
        <>
          <div className="hb-dashboard-list-head hidden grid-cols-[auto_minmax(0,1fr)_90px_88px] gap-3 px-1 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide sm:grid">
            <span aria-hidden="true" />
            <span>Assignment</span>
            <span>Due</span>
            <span>Subject</span>
          </div>
          <ul className="divide-y">
            {shown.map((post) => {
              const done = completedSet.has(post.id);
              const due = dueLabelFor(post.due_at);
              const subjects = Array.isArray(post.subject) ? post.subject : [];
              const subjectLabel = subjects.join(", ");
              return (
                <li key={post.id}>
                  <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 py-3 sm:grid-cols-[auto_minmax(0,1fr)_90px_88px]">
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

                    <Link href={`/posts/${post.id}`} className="min-w-0">
                      <span
                        className={
                          "hb-card-section block truncate text-sm " +
                          (done ? "hb-card-faded line-through" : "")
                        }
                      >
                        {post.title}
                      </span>
                      <span className={"mt-0.5 block text-xs font-medium sm:hidden " + due.className}>
                        {due.text}{subjectLabel ? ` · ${subjectLabel}` : ""}
                      </span>
                    </Link>

                    <span className={"hidden text-xs font-medium sm:block " + due.className}>
                      {due.text}
                    </span>
                    <span className="hb-card-meta hidden truncate text-xs sm:block">
                      {subjectLabel || "No subject"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
