"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { deleteComment } from "@/actions/comments";
import { Avatar } from "@/components/Avatar";
import { CommentForm } from "@/components/CommentForm";
import { PendingButton } from "@/components/PendingButton";
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
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-slate-600" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <div>
          <p className="hb-card-section text-sm">No comments yet</p>
          <p className="hb-card-meta mt-0.5 text-xs">Be the first to ask a question!</p>
        </div>
      </div>
    );
  }

  function renderNode(node: CommentNode, depth: number) {
    const isReply = depth > 0;
    const showReplyForm = replyTo === node.id;
    const attachments = attachmentsByCommentId[node.id] ?? [];

    return (
      <li key={node.id} className="relative">
        {/* Thread connector line for replies */}
        {isReply && (
          <>
            <div className="hb-comment-thread-line" style={{ left: "-12px" }} />
            <div className="hb-comment-thread-dot" style={{ left: "-14px", top: "20px" }} />
          </>
        )}

        <div className={`rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
          isReply
            ? "border-slate-200/70 bg-slate-50/50"
            : "border-slate-200"
        }`}>
          {/* Author & timestamp */}
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Avatar
                id={node.author_id}
                name={node.profiles?.full_name ?? "Student"}
                src={node.profiles?.avatar_url ?? null}
                size="sm"
              />
              <span className="hb-card-section text-sm">
                {node.profiles?.full_name ?? "Student"}
              </span>
              {isReply && (
                <span className="hb-card-meta rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">
                  Reply
                </span>
              )}
            </div>
            <time className="hb-card-meta shrink-0 text-xs" dateTime={node.created_at}>
              {formatDistanceToNow(new Date(node.created_at), {
                addSuffix: true,
              })}
            </time>
          </div>

          {/* Content */}
          <div className={isReply ? "relative pl-4" : ""}>
            {isReply && (
              <div className="absolute left-0 top-0 h-full w-0.5 rounded-full bg-gradient-to-b from-blue-200 to-blue-100" />
            )}
            <p className="hb-card-body whitespace-pre-line text-sm leading-relaxed">
              {node.content}
            </p>
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {attachments.map((attachment) => {
                const isImage = attachment.mime_type.startsWith("image/");
                return (
                  <li key={attachment.id} className="overflow-hidden rounded-lg border border-slate-200 transition hover:shadow-md">
                    <a href={attachment.url} target="_blank" rel="noreferrer" className="block">
                      {isImage ? (
                        <img
                          src={attachment.url}
                          alt={attachment.original_name}
                          className="h-28 w-full object-cover"
                        />
                      ) : (
                        <div className="hb-card-section flex h-28 items-center justify-center bg-slate-50 text-xs font-semibold">
                          <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                            PDF
                          </div>
                        </div>
                      )}
                      <div className="hb-card-meta truncate px-3 py-2 text-xs">
                        {attachment.original_name}
                      </div>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Actions */}
          <div className="mt-3 flex items-center gap-3">
            {(!commentsLocked || isAdmin) && (
              <button
                type="button"
                className="flex items-center gap-1 text-xs font-medium text-blue-600 transition hover:text-blue-700"
                onClick={() => setReplyTo((prev) => (prev === node.id ? null : node.id))}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                {replyTo === node.id ? "Cancel" : "Reply"}
              </button>
            )}

            {(node.author_id === currentUserId || isAdmin) && (
              <form action={deleteComment}>
                <input type="hidden" name="commentId" value={node.id} />
                <input type="hidden" name="postId" value={node.post_id} />
                <PendingButton
                  type="submit"
                  pendingContent="Deleting..."
                  className="flex items-center gap-1 text-xs font-medium text-red-500 transition hover:text-red-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Delete
                </PendingButton>
              </form>
            )}
          </div>

          {/* Reply form */}
          {showReplyForm && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <CommentForm
                postId={node.post_id}
                parentCommentId={node.id}
                placeholder="Write a reply..."
                onSuccess={() => setReplyTo(null)}
              />
            </div>
          )}
        </div>

        {/* Replies */}
        {node.replies.length > 0 && (
          <ul className="ml-6 mt-3 space-y-3">
            {node.replies.map((child) => renderNode(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <ul className="space-y-4">
      {tree.map((node) => renderNode(node, 0))}
    </ul>
  );
}
