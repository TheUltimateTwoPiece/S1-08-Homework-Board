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
import { PendingButton } from "@/components/PendingButton";
import { PostCompleteCheckbox } from "@/components/PostCompleteCheckbox";
import { deletePost, setPostCommentsLocked, setPostPinned } from "@/actions/posts";
import type { Attachment, Comment, Post, PostEdit, Profile } from "@/lib/types";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const revalidate = 0;

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

  const [allProfilesResult, postCompletionsResult] = isAdmin
    ? await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, role")
          .order("full_name"),
        supabase
          .from("post_completions")
          .select("user_id")
          .eq("post_id", id),
      ])
    : [null, null];

  const allProfiles = (allProfilesResult?.data ?? []) as (Pick<Profile, "id" | "full_name" | "email"> & { role: string })[];
  const completedUserIds = new Set(
    (postCompletionsResult?.data ?? []).map((row) => row.user_id as string),
  );
  const completedCount = Array.from(completedUserIds).length;
  const remainingCount = Math.max(0, allProfiles.length - completedCount);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-blue-600 transition hover:text-blue-700"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to all posts
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <article
          className={`rounded-xl border bg-white p-6 shadow-sm ${
            isCompleted ? "hb-card--completed" : "border-slate-200"
          }`}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <PostCompleteCheckbox
                postId={typedPost.id}
                completed={isCompleted}
              />
              <h1
                className={`text-2xl font-bold tracking-tight ${
                  isCompleted ? "text-slate-600 dark:text-slate-200 line-through" : "text-zinc-950"
                }`}
              >
                {typedPost.title}
              </h1>
            </div>
            {isAdmin && (
              <div className="flex shrink-0 items-center gap-2">
                <form action={setPostPinned}>
                  <input type="hidden" name="postId" value={typedPost.id} />
                  <input type="hidden" name="pinned" value={typedPost.pinned ? "false" : "true"} />
                  <PendingButton
                    type="submit"
                    pendingContent="Saving..."
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-700 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    {typedPost.pinned ? "Unpin" : "Pin"}
                  </PendingButton>
                </form>
                <form action={setPostCommentsLocked}>
                  <input type="hidden" name="postId" value={typedPost.id} />
                  <input type="hidden" name="locked" value={commentsLocked ? "false" : "true"} />
                  <PendingButton
                    type="submit"
                    pendingContent="Saving..."
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-700 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    {commentsLocked ? "Unlock" : "Lock"} comments
                  </PendingButton>
                </form>
                <form action={deletePost}>
                  <input type="hidden" name="postId" value={typedPost.id} />
                  <PendingButton
                    type="submit"
                    pendingContent="Deleting..."
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-500 transition hover:bg-red-50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    Delete
                  </PendingButton>
                </form>
              </div>
            )}
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-2">
            {typedPost.pinned && (
              <span className="hb-badge-new inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold">📌 Pinned</span>
            )}
            <span className="hb-badge-subject inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
              {typedPost.subject}
            </span>
            {dueBadge && (
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${dueBadge.className}`}>
                {dueBadge.label}
              </span>
            )}
            {wasEdited && (
              <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-200">Edited</span>
            )}
            <span className="mx-0.5 text-slate-700 dark:text-slate-700">·</span>
            <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-700">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              {typedPost.profiles?.full_name ?? "Admin"}
            </div>
            <span className="text-slate-700 dark:text-slate-700">·</span>
            <time className="text-xs text-slate-700 dark:text-slate-700" dateTime={typedPost.created_at}>
              {format(new Date(typedPost.created_at), "MMMM d, yyyy 'at' h:mm a")}
            </time>
          </div>

          <div className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
            {typedPost.content}
          </div>

          <AttachmentList attachments={signedPostAttachments} />
        </article>

        {isAdmin && allProfiles.length > 0 ? (
          <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800/80">
            <details className="group">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700 transition hover:text-zinc-950 dark:text-slate-300 dark:hover:text-zinc-950 dark:text-slate-100">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-slate-600 dark:text-slate-200 transition group-open:rotate-90" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                Completion ({completedCount}/{allProfiles.length})
              </summary>
              <div className="mt-3 space-y-1">
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-green-500 transition-all duration-500"
                      style={{ width: `${(completedCount / allProfiles.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-700">
                    {Math.round((completedCount / allProfiles.length) * 100)}%
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-200">
                  {completedCount} completed · {remainingCount} remaining
                </p>
              </div>
              <ul className="mt-4 space-y-1.5">
                {allProfiles.map((person) => {
                  const done = completedUserIds.has(person.id);
                  const isAdminProfile = person.role === "admin";
                  return (
                    <li
                      key={person.id}
                      className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 transition hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-medium ${done ? "text-green-700 dark:text-green-400" : "text-slate-700 dark:text-slate-700"}`}>
                            {person.full_name}
                          </span>
                          {isAdminProfile && (
                            <span className="hb-badge-admin rounded px-1 py-0.5 text-[9px] font-semibold">Admin</span>
                          )}
                        </div>
                        <div className="truncate text-xs text-slate-600 dark:text-slate-200">{person.email}</div>
                      </div>
                      <span className={`flex items-center gap-1 text-xs font-semibold ${done ? "text-green-600 dark:text-green-400" : "text-slate-600 dark:text-slate-200"}`}>
                        {done ? (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Done
                          </>
                        ) : (
                          <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </details>
          </aside>
        ) : null}
      </div>

      {isAdmin && (
        <details className="group mt-6">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700 transition hover:text-zinc-950">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-slate-600 dark:text-slate-200 transition group-open:rotate-90" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
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
          <h2 className="mb-4 text-base font-semibold text-slate-700">Edit history</h2>
          <ul className="space-y-3">
            {typedEdits.map((edit) => {
              const keys = Object.keys(edit.changes ?? {});
              return (
                <li key={edit.id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                  <div className="mb-1.5 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-200">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    </svg>
                    {format(new Date(edit.created_at), "MMM d, yyyy 'at' h:mm a")}
                  </div>
                  <div className="text-sm text-slate-700 dark:text-slate-700">
                    {keys.length > 0 ? keys.join(", ") : "Updated"}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <div className="mb-6 flex items-center gap-3">
          <h2 className="text-base font-semibold text-zinc-950">
            Comments ({comments?.length ?? 0})
          </h2>
        </div>

        <div className="mb-6">
          {canComment ? (
            <CommentForm postId={id} />
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:text-slate-700">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Comments are locked for this post.
            </div>
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
