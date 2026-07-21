import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
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
      className={`relative flex items-start gap-4 rounded-xl border bg-white p-5 transition-all duration-200 ${
        completed
          ? "hb-card--completed"
          : "border-slate-200 shadow-sm hover:border-blue-300/50 hover:shadow-lg hover:-translate-y-0.5"
      }`}
    >
      <PostCompleteCheckbox postId={post.id} completed={completed} compact />

      <Link href={`/posts/${post.id}`} className="min-w-0 flex-1 group">
        <div className="mb-2 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              {post.pinned && (
                <span className="hb-badge-new inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold">
                  📌 Pinned
                </span>
              )}
              <span className="hb-badge-subject inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                {post.subject}
              </span>
              {dueBadge && (
                <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${dueBadge.className}`}>
                  {dueBadge.label}
                </span>
              )}
              {wasEdited && (
                <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                  Edited
                </span>
              )}
            </div>
            <h2
              className={`text-base font-semibold leading-snug transition-colors duration-150 group-hover:text-blue-600 ${
                completed ? "text-slate-400 line-through" : "text-slate-900"
              }`}
            >
              {post.title}
            </h2>
          </div>
          <time
            className="shrink-0 whitespace-nowrap text-[11px] font-medium text-slate-400"
            dateTime={post.created_at}
          >
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </time>
        </div>
        <p className={`mt-1.5 line-clamp-2 whitespace-pre-line text-sm leading-relaxed ${
          completed ? "text-slate-400" : "text-slate-600"
        }`}>
          {post.content}
        </p>
        {post.profiles?.full_name && (
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            {post.profiles.full_name}
          </div>
        )}
      </Link>
    </div>
  );
}
