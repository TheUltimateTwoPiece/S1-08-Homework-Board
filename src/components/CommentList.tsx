import { formatDistanceToNow } from "date-fns";
import { deleteComment } from "@/actions/comments";
import type { Comment } from "@/lib/types";

type CommentListProps = {
  comments: Comment[];
  currentUserId: string;
};

export function CommentList({ comments, currentUserId }: CommentListProps) {
  if (comments.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No comments yet. Be the first to ask a question!
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {comments.map((comment) => (
        <li
          key={comment.id}
          className="rounded-lg border border-slate-100 bg-slate-50 p-4"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-900">
              {comment.profiles?.full_name ?? "Student"}
            </span>
            <time
              className="text-xs text-slate-500"
              dateTime={comment.created_at}
            >
              {formatDistanceToNow(new Date(comment.created_at), {
                addSuffix: true,
              })}
            </time>
          </div>
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {comment.content}
          </p>
          {comment.author_id === currentUserId && (
            <form action={deleteComment} className="mt-2">
              <input type="hidden" name="commentId" value={comment.id} />
              <input type="hidden" name="postId" value={comment.post_id} />
              <button
                type="submit"
                className="text-xs text-red-600 hover:text-red-700"
              >
                Delete
              </button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
