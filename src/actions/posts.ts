"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notifyNewPost } from "@/actions/notifications";

function normalizeMultilineText(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function normalizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function normalizeStorageError(message: string): string {
  if (!message) return "Upload failed.";
  if (message.toLowerCase().includes("row-level security")) {
    return "File upload blocked by Supabase Storage security. Add an insert policy on storage.objects for the attachments bucket (and optionally select/delete too).";
  }
  return message;
}

function normalizeDatabaseError(message: string): string {
  if (!message) return "Request failed.";
  if (message.toLowerCase().includes("row-level security")) {
    return "Upload saved, but attaching the file was blocked by database security. Ensure RLS insert policies exist for the attachments table.";
  }
  return message;
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/");

  return { supabase, user };
}

export async function createPost(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  const title = (formData.get("title") as string).trim();
  const content = normalizeMultilineText(formData.get("content") as string);
  const subject = ((formData.get("subject") as string | null) ?? "General").trim() || "General";
  const dueAtRaw = ((formData.get("dueAt") as string | null) ?? "").trim();
  const pinned = formData.get("pinned") === "on";
  const files = (formData.getAll("files") as File[]).filter((file) => file.size > 0);

  if (!title || !content) {
    return { error: "Title and content are required." };
  }

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      title,
      content,
      subject,
      due_at: dueAtRaw ? dueAtRaw : null,
      pinned,
      author_id: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  if (post && files.length > 0) {
    const maxBytes = 10 * 1024 * 1024;

    // Validate every file up front so we don't half-upload and have to
    // roll back on a single bad file later in the loop.
    for (const file of files) {
      if (file.size > maxBytes) {
        return { error: `File "${file.name}" is too large.` };
      }
      const isAllowed =
        file.type === "application/pdf" || file.type.startsWith("image/");
      if (!isAllowed) {
        return { error: `File type not allowed: "${file.name}".` };
      }
    }

    const bucket = "attachments";
    const paths = files.map(
      (file) => `posts/${post.id}/${crypto.randomUUID()}-${normalizeFileName(file.name)}`,
    );

    // Upload all files in parallel — was sequential before, which stalled
    // the request when multiple files were attached.
    const uploadResults = await Promise.all(
      files.map((file, i) =>
        supabase.storage
          .from(bucket)
          .upload(paths[i], file, { contentType: file.type })
          .then(({ error }) => ({ error, path: paths[i], file })),
      ),
    );

    const failed = uploadResults.find((r) => r.error);
    if (failed) {
      // Roll back any successful uploads and the post row itself.
      const successfulPaths = uploadResults
        .filter((r) => !r.error)
        .map((r) => r.path);
      if (successfulPaths.length > 0) {
        await supabase.storage.from(bucket).remove(successfulPaths);
      }
      await supabase.from("posts").delete().eq("id", post.id);
      return { error: normalizeStorageError(failed.error!.message) };
    }

    const uploads = files.map((file, i) => ({
      uploader_id: user.id,
      post_id: post.id,
      bucket,
      path: paths[i],
      original_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    }));

    const { error: attachmentError } = await supabase
      .from("attachments")
      .insert(uploads);

    if (attachmentError) {
      await supabase.storage.from(bucket).remove(paths);
      await supabase.from("posts").delete().eq("id", post.id);
      return { error: normalizeDatabaseError(attachmentError.message) };
    }
  }

  // Fan out new-post notifications beyond this point. Errors are deliberately
  // swallowed — the post, attachments, and any admin failures of the
  // notification insert are local to the in-app notification table; Brevo
  // failures record into `email_error` on each row, already handled in
  // `notifyNewPost`. Returning `{ success: true }` means: the post is live.
  try {
    await fanOutPostNotifications(supabase, post!.id, user.id);
  } catch (err) {
    console.error("[createPost] notify fan-out failed", err);
  }

  // Always revalidate /notifications — notifyNewPost's internal revalidation
  // runs on the happy path, but if the fan-out threw, the cache is still
  // stale. Forcing a revalidate here means the bell icon picks up whatever
  // notification rows DID land before the throw, plus any successful sends.
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/notifications");
  revalidatePath(`/posts/${post.id}`);
  return { success: true };
}

/**
 * Sends a Brevo email + in-app bell notification for the post just created.
 * Soft-fail by design — if Brevo is unreachable, the post is still live and
 * the per-row `email_error` on each notification row tells admins why no
 * email went out. Runs AFTER storage uploads so a failed email pipeline
 * never blocks a user-visible post.
 */
async function fanOutPostNotifications(
  supabase: Awaited<ReturnType<typeof createClient>>,
  postId: string,
  authorId: string,
) {
  const { data: post } = await supabase
    .from("posts")
    .select("title, subject, due_at")
    .eq("id", postId)
    .single();

  if (!post) return;

  await notifyNewPost({
    postId,
    postTitle: (post as { title?: string }).title ?? "New homework",
    postSubject: (post as { subject?: string }).subject ?? "General",
    postDueAt: (post as { due_at?: string | null }).due_at ?? null,
    authorId,
  });
}

export async function updatePost(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  const postId = formData.get("postId") as string;
  const title = (formData.get("title") as string).trim();
  const content = normalizeMultilineText(formData.get("content") as string);
  const subject = ((formData.get("subject") as string | null) ?? "General").trim() || "General";
  const dueAtRaw = ((formData.get("dueAt") as string | null) ?? "").trim();
  const dueAt = dueAtRaw ? dueAtRaw : null;
  const pinned = formData.get("pinned") === "on";

  if (!postId) return { error: "Missing post id." };
  if (!title || !content) return { error: "Title and content are required." };

  const { data: existing, error: existingError } = await supabase
    .from("posts")
    .select("title, content, subject, due_at, pinned")
    .eq("id", postId)
    .single();

  if (existingError || !existing) {
    return { error: existingError?.message ?? "Post not found." };
  }

  const changes: Record<string, unknown> = {};

  if (existing.title !== title) changes.title = { from: existing.title, to: title };
  if (existing.content !== content) changes.content = { from: existing.content, to: content };
  if (existing.subject !== subject) changes.subject = { from: existing.subject, to: subject };
  if ((existing.due_at ?? null) !== dueAt) changes.due_at = { from: existing.due_at ?? null, to: dueAt };
  if (existing.pinned !== pinned) changes.pinned = { from: existing.pinned, to: pinned };

  if (Object.keys(changes).length === 0) {
    return { error: "No changes to save." };
  }

  const { error: updateError } = await supabase
    .from("posts")
    .update({
      title,
      content,
      subject,
      due_at: dueAt,
      pinned,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);

  if (updateError) {
    return { error: updateError.message };
  }

  const { error: editError } = await supabase.from("post_edits").insert({
    post_id: postId,
    edited_by: user.id,
    changes,
  });

  if (editError) {
    return { error: editError.message };
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath(`/posts/${postId}`);
  revalidatePath("/admin");
  return { success: true };
}

export async function deletePost(formData: FormData) {
  const { supabase } = await requireAdmin();
  const postId = formData.get("postId") as string;

  // Fetch every attachment row (post + comment attachments cascade via FK)
  // BEFORE deleting the DB rows, so we can clean up the physical storage
  // objects. Otherwise deleting the post leaves orphaned files in the
  // attachments bucket forever.
  //
  // We do two parameterised reads instead of interpolating postId into a
  // PostgREST `.or()` filter string — admin-only, but defense in depth
  // against accidental bad input or future code that constructs postId
  // from an untrusted source.
  const [{ data: postAttachments }, { data: commentIdRows }] = await Promise.all([
    supabase
      .from("attachments")
      .select("bucket, path")
      .eq("post_id", postId),
    supabase
      .from("comments")
      .select("id")
      .eq("post_id", postId),
  ]);

  const commentIds = (commentIdRows ?? []).map((row) => row.id);

  const { data: commentAttachments } = commentIds.length > 0
    ? await supabase
        .from("attachments")
        .select("bucket, path")
        .in("comment_id", commentIds)
    : { data: [] as { bucket: string; path: string }[] | null };

  const attachments = [
    ...(postAttachments ?? []),
    ...(commentAttachments ?? []),
  ];

  const { error } = await supabase.from("posts").delete().eq("id", postId);

  if (error) {
    throw new Error(error.message);
  }

  // Best-effort storage cleanup — never block the redirect on this.
  if (attachments.length > 0) {
    const byBucket = new Map<string, string[]>();
    for (const a of attachments) {
      if (!a.bucket || !a.path) continue;
      const list = byBucket.get(a.bucket) ?? [];
      list.push(a.path);
      byBucket.set(a.bucket, list);
    }
    await Promise.all(
      Array.from(byBucket.entries()).map(([bucket, paths]) =>
        supabase.storage.from(bucket).remove(paths),
      ),
    );
  }

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/");
}

export async function setPostCommentsLocked(formData: FormData) {
  const { supabase } = await requireAdmin();
  const postId = formData.get("postId") as string;
  const lockedRaw = (formData.get("locked") as string | null) ?? "false";
  const locked = lockedRaw === "true";

  const { error } = await supabase
    .from("posts")
    .update({ comments_locked: locked, updated_at: new Date().toISOString() })
    .eq("id", postId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath(`/posts/${postId}`);
}

export async function setPostPinned(formData: FormData) {
  const { supabase } = await requireAdmin();
  const postId = formData.get("postId") as string;
  const pinnedRaw = (formData.get("pinned") as string | null) ?? "false";
  const pinned = pinnedRaw === "true";

  const { error } = await supabase
    .from("posts")
    .update({ pinned, updated_at: new Date().toISOString() })
    .eq("id", postId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath(`/posts/${postId}`);
  revalidatePath("/admin");
}
