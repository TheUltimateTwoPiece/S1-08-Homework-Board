import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getDueBadge } from "@/lib/due";
import { AttachmentList } from "@/components/AttachmentList";
import { CommentForm } from "@/components/CommentForm";
import { CommentList } from "@/components/CommentList";
import { EditPostForm } from "@/components/EditPostForm";
import { PostCompleteCheckbox } from "@/components/PostCompleteCheckbox";
import { deletePost, setPostCommentsLocked, setPostPinned } from "@/actions/posts";
import type { Attachment, Comment, Post, PostEdit, Profile } from "@/lib/types";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const revalidate = 30;

export default async function PostPage({ params }: PageProps) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: post }, { data: comments }, { data: completion }] = await Promise.all([
    supabase
      .from("posts")
      .select("*, profiles(full_name)")
      .eq("id", id)
      .single(),
    supabase
      .from("comments")
      .select("*, profiles(full_name)")
      .eq("post_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("post_completions")
      .select("id")
      .eq("post_id", id)
      .eq("user_id", profile.id)
      .maybeSingle(),
  ]);

  if (!post) notFound();

  const typedPost = post as Post;
  const isCompleted = Boolean(completion);
  const isAdmin = profile.role === "admin";
  const commentsLocked = typedPost.comments_locked;
  const canComment = isAdmin || !commentsLocked;
  const dueBadge = getDueBadge(typedPost.due_at);
  const wasEdited =
    new Date(typedPost.updated_at).getTime() - new Date(typedPost.created_at).getTime() >
    60 * 1000;
  const typedComments = ((comments as Comment[]) ?? []).map((comment) => ({
    ...comment,
    parent_comment_id: comment.parent_comment_id ?? null,
  })) as Comment[];
  const commentIds = typedComments.map((comment) => comment.id);

  const [postAttachmentsResult, commentAttachmentsResult] = await Promise.all([
    supabase
      .from("attachments")
      .select("*")
      .eq("post_id", id)
      .order("created_at", { ascending: true }),
    commentIds.length > 0
      ? supabase
          .from("attachments")
          .select("*")
          .in("comment_id", commentIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as Attachment[] | null }),
  ]);

  const postAttachments = (postAttachmentsResult.data as Attachment[] | null) ?? [];
  const commentAttachments =
    (commentAttachmentsResult.data as Attachment[] | null) ?? [];

  const signedPostAttachments = (
    await Promise.all(
      postAttachments.map(async (attachment) => {
        const { data } = await supabase.storage
          .from(attachment.bucket)
          .createSignedUrl(attachment.path, 60 * 60 * 24 * 7);

        if (!data?.signedUrl) return null;

        return {
          id: attachment.id,
          url: data.signedUrl,
          original_name: attachment.original_name,
          mime_type: attachment.mime_type,
        };
      }),
    )
  ).filter(Boolean) as { id: string; url: string; original_name: string; mime_type: string }[];

  const signedCommentAttachments = (
    await Promise.all(
      commentAttachments.map(async (attachment) => {
        const { data } = await supabase.storage
          .from(attachment.bucket)
          .createSignedUrl(attachment.path, 60 * 60 * 24 * 7);

        if (!data?.signedUrl) return null;

        return {
          id: attachment.id,
          comment_id: attachment.comment_id,
          url: data.signedUrl,
          original_name: attachment.original_name,
          mime_type: attachment.mime_type,
        };
      }),
    )
  ).filter(Boolean) as {
    id: string;
    comment_id: string | null;
    url: string;
    original_name: string;
    mime_type: string;
  }[];

  const attachmentsByCommentId = signedCommentAttachments.reduce(
    (acc, attachment) => {
      if (!attachment.comment_id) return acc;
      acc[attachment.comment_id] ??= [];
      acc[attachment.comment_id].push({
        id: attachment.id,
        url: attachment.url,
        original_name: attachment.original_name,
        mime_type: attachment.mime_type,
      });
      return acc;
    },
    {} as Record<
      string,
      { id: string; url: string; original_name: string; mime_type: string }[]
    >,
  );

  const { data: postEdits } = await supabase
    .from("post_edits")
    .select("id, changes, created_at")
    .eq("post_id", id)
    .order("created_at", { ascending: false })
    .limit(10);
  const typedEdits = (postEdits as PostEdit[]) ?? [];

  const [studentsResult, postCompletionsResult] = isAdmin
    ? await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("role", "student")
          .order("full_name"),
        supabase
          .from("post_completions")
          .select("user_id")
          .eq("post_id", id),
      ])
    : [null, null];

  const students = ((studentsResult?.data as Pick<Profile, "id" | "full_name" | "email">[]) ??
    []) as Pick<Profile, "id" | "full_name" | "email">[];
  const completedUserIds = new Set(
    (postCompletionsResult?.data ?? []).map((row) => row.user_id as string),
  );
  const completedCount = Array.from(completedUserIds).length;
  const remainingCount = Math.max(0, students.length - completedCount);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/"
        className="hb-link mb-6 inline-block text-sm"
      >
        ← Back to all posts
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <article
          className={`hb-card p-6 ${isCompleted ? "hb-card--completed" : ""}`}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <PostCompleteCheckbox
                postId={typedPost.id}
                completed={isCompleted}
              />
              <h1
                className={`text-2xl font-bold ${
                  isCompleted ? "hb-text-subtle line-through" : "hb-text"
                }`}
              >
                {typedPost.title}
              </h1>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-3">
                <form action={setPostPinned}>
                  <input type="hidden" name="postId" value={typedPost.id} />
                  <input
                    type="hidden"
                    name="pinned"
                    value={typedPost.pinned ? "false" : "true"}
                  />
                  <button type="submit" className="hb-link text-sm font-medium">
                    {typedPost.pinned ? "Unpin" : "Pin"}
                  </button>
                </form>
                <form action={setPostCommentsLocked}>
                  <input type="hidden" name="postId" value={typedPost.id} />
                  <input
                    type="hidden"
                    name="locked"
                    value={commentsLocked ? "false" : "true"}
                  />
                  <button type="submit" className="hb-link text-sm font-medium">
                    {commentsLocked ? "Unlock comments" : "Lock comments"}
                  </button>
                </form>
                <form action={deletePost}>
                  <input type="hidden" name="postId" value={typedPost.id} />
                  <button
                    type="submit"
                    className="hb-text-error text-sm hover:underline"
                  >
                    Delete post
                  </button>
                </form>
              </div>
            )}
          </div>

          <div className="hb-text-subtle mb-6 flex flex-wrap items-center gap-2 text-xs">
            {typedPost.pinned && (
              <span className="hb-badge-new rounded px-2 py-0.5 text-[10px] font-semibold">
                Pinned
              </span>
            )}
            <span className="text-[10px] font-semibold uppercase tracking-wide">
              {typedPost.subject}
            </span>
            {dueBadge && (
              <span className={`${dueBadge.className} text-[10px] font-semibold`}>
                {dueBadge.label}
              </span>
            )}
            {wasEdited && (
              <span className="hb-text-subtle text-[10px] font-semibold">
                Edited
              </span>
            )}
            <span className="mx-1 text-slate-300">·</span>
            <span>{typedPost.profiles?.full_name ?? "Admin"}</span>
            <span className="text-slate-300">·</span>
            <time dateTime={typedPost.created_at}>
              {format(new Date(typedPost.created_at), "MMMM d, yyyy 'at' h:mm a")}
            </time>
          </div>

          <div className="hb-text-muted whitespace-pre-line text-sm leading-relaxed">
            {typedPost.content}
          </div>

          <AttachmentList attachments={signedPostAttachments} />
        </article>

        {isAdmin && students.length > 0 ? (
          <aside className="hb-card p-5">
            <details>
              <summary className="hb-link cursor-pointer text-sm font-semibold">
                Completion ({completedCount}/{students.length})
              </summary>
              <div className="hb-text-muted mt-3 text-sm">
                {completedCount} completed · {remainingCount} remaining
              </div>
              <ul className="mt-4 space-y-2">
                {students.map((student) => {
                  const done = completedUserIds.has(student.id);
                  return (
                    <li
                      key={student.id}
                      className="hb-card hb-card-muted flex items-center justify-between gap-3 p-4"
                    >
                      <div className="min-w-0">
                        <div className="hb-text font-medium">{student.full_name}</div>
                        <div className="hb-text-subtle truncate text-xs">{student.email}</div>
                      </div>
                      <div
                        className={`text-xs font-semibold ${
                          done ? "hb-text-success" : "hb-text-subtle"
                        }`}
                      >
                        {done ? "Completed" : "Not yet"}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </details>
          </aside>
        ) : null}
      </div>

      {isAdmin && (
        <details className="mt-6">
          <summary className="hb-link cursor-pointer text-sm font-semibold">
            Edit post
          </summary>
          <div className="mt-4">
            <EditPostForm
              post={{
                id: typedPost.id,
                title: typedPost.title,
                content: typedPost.content,
                subject: typedPost.subject,
                due_at: typedPost.due_at,
                pinned: typedPost.pinned,
              }}
            />
          </div>
        </details>
      )}

      {typedEdits.length > 0 && (
        <section className="mt-8">
          <h2 className="hb-text mb-4 text-lg font-semibold">Edit history</h2>
          <ul className="space-y-3">
            {typedEdits.map((edit) => {
              const keys = Object.keys(edit.changes ?? {});
              return (
                <li key={edit.id} className="hb-card hb-card-muted p-4">
                  <div className="hb-text-subtle mb-2 text-xs">
                    {format(new Date(edit.created_at), "MMM d, yyyy 'at' h:mm a")}
                  </div>
                  <div className="hb-text-muted text-sm">
                    {keys.length > 0 ? keys.join(", ") : "Updated"}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="hb-text mb-4 text-lg font-semibold">
          Comments ({comments?.length ?? 0})
        </h2>

        <div className="mb-6">
          {canComment ? (
            <CommentForm postId={id} />
          ) : (
            <p className="hb-text-subtle text-sm">
              Comments are locked for this post.
            </p>
          )}
        </div>

        <CommentList
          comments={typedComments}
          currentUserId={profile.id}
          isAdmin={isAdmin}
          commentsLocked={commentsLocked}
          attachmentsByCommentId={attachmentsByCommentId}
        />
      </section>
    </div>
  );
}
