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
      <p className="hb-text-subtle text-sm">
        No comments yet. Be the first to ask a question!
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {comments.map((comment) => (
        <li
          key={comment.id}
          className="hb-card hb-card-muted p-4"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="hb-text text-sm font-medium">
              {comment.profiles?.full_name ?? "Student"}
            </span>
            <time
              className="hb-text-subtle text-xs"
              dateTime={comment.created_at}
            >
              {formatDistanceToNow(new Date(comment.created_at), {
                addSuffix: true,
              })}
            </time>
          </div>
          <p className="hb-text-muted whitespace-pre-line text-sm leading-relaxed">
            {comment.content}
          </p>
          {comment.author_id === currentUserId && (
            <form action={deleteComment} className="mt-2">
              <input type="hidden" name="commentId" value={comment.id} />
              <input type="hidden" name="postId" value={comment.post_id} />
              <button
                type="submit"
                className="hb-text-error text-xs hover:underline"
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
