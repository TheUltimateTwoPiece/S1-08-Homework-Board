import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Avatar } from "@/components/Avatar";
import { PostCompleteCheckbox } from "@/components/PostCompleteCheckbox";
import { getDueBadge } from "@/lib/due";
import type { Post } from "@/lib/types";

type PostCardProps = {
  post: Post;
  completed: boolean;
};

export function PostCard({ post, completed }: PostCardProps) {
  const dueBadge = getDueBadge(post.due_at);
  const wasEdited =
    new Date(post.updated_at).getTime() - new Date(post.created_at).getTime() >
    60 * 1000;

  return (
    <div
      className={`relative flex items-start gap-4 border-b p-5 transition-colors duration-150 ${
        completed
          ? "border-emerald-300/70 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30"
          : "border-[var(--hb-border)] bg-[var(--hb-surface)] hover:bg-[var(--hb-surface-hover)]"
      }`}
    >
      <PostCompleteCheckbox postId={post.id} completed={completed} compact />

      <Link href={`/posts/${post.id}`} className="min-w-0 flex-1 group">
        <div className="mb-2 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              {post.pinned && (
                <span className="hb-badge-new inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold">
                  Pinned
                </span>
              )}
              {post.subject.map((subject) => (
                <span
                  key={subject}
                  className="hb-badge-subject inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                >
                  {subject}
                </span>
              ))}
              {(post.checklist?.length ?? 0) > 0 && (
                <span className="hb-card-meta inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold dark:bg-stone-700/40">
                  ✓ {post.checklist.length} step{post.checklist.length === 1 ? "" : "s"}
                </span>
              )}
              {dueBadge && (
                <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${dueBadge.className}`}>
                  {dueBadge.label}
                </span>
              )}
              {wasEdited && (
                <span className="hb-card-meta inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px]">
                  Edited
                </span>
              )}
            </div>
            <h2
              className={`text-base leading-snug transition-colors duration-150 group-hover:text-blue-600 dark:group-hover:text-blue-400 ${
                completed ? "hb-card-faded line-through" : "hb-card-section"
              }`}
            >
              {post.title}
            </h2>
          </div>
          <time
            className="hb-card-meta shrink-0 whitespace-nowrap text-[11px]"
            dateTime={post.created_at}
          >
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </time>
        </div>
        <p
          className={`mt-1.5 line-clamp-2 whitespace-pre-line text-sm leading-relaxed ${
            completed ? "hb-card-faded" : "hb-card-body"
          }`}
        >
          {post.content}
        </p>
        {post.profiles?.full_name && (
          <div className="mt-3 flex items-center gap-2 text-[11px]">
            <Avatar
              id={post.author_id}
              name={post.profiles.full_name}
              src={post.profiles.avatar_url ?? null}
              size="xs"
            />
            <span className="hb-card-meta">{post.profiles.full_name}</span>
          </div>
        )}
      </Link>
    </div>
  );
}
