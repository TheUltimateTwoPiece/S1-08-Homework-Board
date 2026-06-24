"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { deleteComment } from "@/actions/comments";
import { CommentForm } from "@/components/CommentForm";
import type { Comment } from "@/lib/types";

type CommentListProps = {
  comments: Comment[];
  currentUserId: string;
  isAdmin: boolean;
  commentsLocked: boolean;
  attachmentsByCommentId: Record<
    string,
    { id: string; url: string; original_name: string; mime_type: string }[]
  >;
};

type CommentNode = Comment & { replies: CommentNode[] };

function buildCommentTree(comments: Comment[]): CommentNode[] {
  const nodes = new Map<string, CommentNode>();

  for (const comment of comments) {
    nodes.set(comment.id, { ...comment, replies: [] });
  }

  const roots: CommentNode[] = [];

  for (const node of nodes.values()) {
    const parentId = node.parent_comment_id ?? null;
    const parent = parentId ? nodes.get(parentId) : null;

    if (parent) {
      parent.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortTree = (list: CommentNode[]) => {
    list.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    for (const item of list) sortTree(item.replies);
  };

  sortTree(roots);
  return roots;
}

export function CommentList({
  comments,
  currentUserId,
  isAdmin,
  commentsLocked,
  attachmentsByCommentId,
}: CommentListProps) {
  const tree = useMemo(() => buildCommentTree(comments), [comments]);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  if (comments.length === 0) {
    return (
      <p className="hb-text-subtle text-sm">
        No comments yet. Be the first to ask a question!
      </p>
    );
  }

  function renderNode(node: CommentNode, depth: number) {
    const isReply = depth > 0;
    const showReplyForm = replyTo === node.id;
    const marginLeft = Math.min(depth, 6) * 16;
    const attachments = attachmentsByCommentId[node.id] ?? [];

    return (
      <li key={node.id} style={{ marginLeft }}>
        <div className="hb-card hb-card-muted p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="hb-text text-sm font-medium">
              {node.profiles?.full_name ?? "Student"}
            </span>
            <time className="hb-text-subtle text-xs" dateTime={node.created_at}>
              {formatDistanceToNow(new Date(node.created_at), {
                addSuffix: true,
              })}
            </time>
          </div>

          <div className={isReply ? "hb-reply" : undefined}>
            {isReply && <span className="hb-reply-arrow">↳</span>}
            <p className="hb-text-muted whitespace-pre-line text-sm leading-relaxed">
              {node.content}
            </p>
          </div>

          {attachments.length > 0 && (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {attachments.map((attachment) => {
                const isImage = attachment.mime_type.startsWith("image/");

                return (
                  <li key={attachment.id} className="hb-card overflow-hidden">
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block"
                    >
                      {isImage ? (
                        <img
                          src={attachment.url}
                          alt={attachment.original_name}
                          className="h-28 w-full object-cover"
                        />
                      ) : (
                        <div className="hb-text flex h-28 items-center justify-center text-xs font-semibold">
                          PDF
                        </div>
                      )}
                      <div className="hb-text-muted truncate px-3 py-2 text-xs">
                        {attachment.original_name}
                      </div>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-3 flex items-center gap-3">
            {(!commentsLocked || isAdmin) && (
              <button
                type="button"
                className="hb-link text-xs font-medium"
                onClick={() => setReplyTo((prev) => (prev === node.id ? null : node.id))}
              >
                Reply
              </button>
            )}

            {(node.author_id === currentUserId || isAdmin) && (
              <form action={deleteComment}>
                <input type="hidden" name="commentId" value={node.id} />
                <input type="hidden" name="postId" value={node.post_id} />
                <button type="submit" className="hb-text-error text-xs hover:underline">
                  Delete
                </button>
              </form>
            )}
          </div>

          {showReplyForm && (
            <div className="mt-4">
              <CommentForm
                postId={node.post_id}
                parentCommentId={node.id}
                placeholder="Write a reply..."
                onSuccess={() => setReplyTo(null)}
              />
            </div>
          )}
        </div>

        {node.replies.length > 0 && (
          <ul className="mt-3 space-y-3">
            {node.replies.map((child) => renderNode(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <ul className="space-y-3">
      {tree.map((node) => renderNode(node, 0))}
    </ul>
  );
}
