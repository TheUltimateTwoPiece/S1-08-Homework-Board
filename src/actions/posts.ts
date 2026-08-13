"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { notifyNewPost } from "@/actions/notifications";
import { DEFAULT_SUBJECT, normalizeSubjects } from "@/lib/subjects";
import { tripProfanity } from "@/lib/profanity";
import type { ChecklistItem } from "@/lib/types";

const MAX_CHECKLIST_ITEMS = 12;
const MAX_CHECKLIST_ITEM_LENGTH = 160;
const MAX_POST_TITLE_LENGTH = 160;
const MAX_POST_CONTENT_LENGTH = 20000;

function normalizeDueDate(value: string): string | null | undefined {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }
  return value;
}

function normalizeMultilineText(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function parseChecklist(value: FormDataEntryValue | null): ChecklistItem[] {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    const ids = new Set<string>();
    return parsed
      .slice(0, MAX_CHECKLIST_ITEMS)
      .flatMap((item): ChecklistItem[] => {
        if (!item || typeof item !== "object") return [];
        const text = "text" in item && typeof item.text === "string"
          ? normalizeMultilineText(item.text).slice(0, MAX_CHECKLIST_ITEM_LENGTH)
          : "";
        if (!text) return [];
        const proposedId = "id" in item && typeof item.id === "string"
          ? item.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80)
          : "";
        const id = proposedId && !ids.has(proposedId) ? proposedId : crypto.randomUUID();
        ids.add(id);
        return [{ id, text }];
      });
  } catch {
    return [];
  }
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
    return "Attaching files was blocked by database security. Ensure RLS insert policies exist for the attachments table.";
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

  const titleValue = formData.get("title");
  const contentValue = formData.get("content");
  const title = typeof titleValue === "string" ? titleValue.trim() : "";
  const content = typeof contentValue === "string" ? normalizeMultilineText(contentValue) : "";
  const subjects = normalizeSubjects(formData.getAll("subject"));
  const checklist = parseChecklist(formData.get("checklist"));
  const dueAtValue = formData.get("dueAt");
  const dueAtRaw = typeof dueAtValue === "string" ? dueAtValue.trim() : "";
  const dueAt = normalizeDueDate(dueAtRaw);
  const pinned = formData.get("pinned") === "on";
  const files = (formData.getAll("files") as File[]).filter((file) => file.size > 0);

  if (!title || !content) {
    return { error: "Title and content are required." };
  }
  if (title.length > MAX_POST_TITLE_LENGTH) {
    return { error: `Title is too long (max ${MAX_POST_TITLE_LENGTH} characters).` };
  }
  if (content.length > MAX_POST_CONTENT_LENGTH) {
    return { error: `Content is too long (max ${MAX_POST_CONTENT_LENGTH} characters).` };
  }
  if (dueAt === undefined) {
    return { error: "Enter a valid due date." };
  }

  // Validate attachments before inserting the post. Otherwise a rejected
  // file would return an error while leaving an orphaned post in the database.
  const maxBytes = 10 * 1024 * 1024;
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

  // Profanity gate: redirect to PROFANITY_REDIRECT_URL if title or
  // content contain any blocked word. Runs BEFORE the insert so
  // nothing is saved when the user trips the filter.
  const profanity = tripProfanity(
    { userId: user.id },
    title,
    content,
    ...checklist.map((item) => item.text),
  );
  if (profanity.triggered) redirect(profanity.redirectUrl);

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      title,
      content,
      checklist,
      subject: subjects,
      due_at: dueAt,
      pinned,
      author_id: user.id,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  if (post && files.length > 0) {
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
  revalidatePath("/your-progress");
  revalidatePath("/due-soon");
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
    postSubject: (post as { subject?: string[] }).subject ?? [DEFAULT_SUBJECT],
    postDueAt: (post as { due_at?: string | null }).due_at ?? null,
    authorId,
  });
}

export async function updatePost(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  const postIdValue = formData.get("postId");
  const titleValue = formData.get("title");
  const contentValue = formData.get("content");
  const postId = typeof postIdValue === "string" ? postIdValue.trim() : "";
  const title = typeof titleValue === "string" ? titleValue.trim() : "";
  const content = typeof contentValue === "string" ? normalizeMultilineText(contentValue) : "";
  const subjects = normalizeSubjects(formData.getAll("subject"));
  const checklist = parseChecklist(formData.get("checklist"));
  const dueAtValue = formData.get("dueAt");
  const dueAtRaw = typeof dueAtValue === "string" ? dueAtValue.trim() : "";
  const dueAt = normalizeDueDate(dueAtRaw);
  const pinned = formData.get("pinned") === "on";

  if (!postId) return { error: "Missing post id." };
  if (!title || !content) return { error: "Title and content are required." };
  if (title.length > MAX_POST_TITLE_LENGTH) {
    return { error: `Title is too long (max ${MAX_POST_TITLE_LENGTH} characters).` };
  }
  if (content.length > MAX_POST_CONTENT_LENGTH) {
    return { error: `Content is too long (max ${MAX_POST_CONTENT_LENGTH} characters).` };
  }
  if (dueAt === undefined) return { error: "Enter a valid due date." };

  // Same profanity gate as createPost — admins shouldn't sneak past the
  // filter by editing an existing post or checklist step.
  const profanity = tripProfanity(
    { userId: user.id },
    title,
    content,
    ...checklist.map((item) => item.text),
  );
  if (profanity.triggered) redirect(profanity.redirectUrl);

  const { data: existing, error: existingError } = await supabase
    .from("posts")
    .select("title, content, checklist, subject, due_at, pinned")
    .eq("id", postId)
    .single();

  if (existingError || !existing) {
    return { error: existingError?.message ?? "Post not found." };
  }

  const changes: Record<string, unknown> = {};

  const existingSubjects = Array.isArray(existing.subject)
    ? (existing.subject as string[])
    : [(existing.subject as string | null) ?? DEFAULT_SUBJECT];
  const sameSubjects =
    existingSubjects.length === subjects.length &&
    [...existingSubjects].sort().join("\u0000") === [...subjects].sort().join("\u0000");
  const existingChecklist = parseChecklist(
    typeof existing.checklist === "string" ? existing.checklist : JSON.stringify(existing.checklist ?? []),
  );
  const sameChecklist = JSON.stringify(existingChecklist) === JSON.stringify(checklist);

  if (existing.title !== title) changes.title = { from: existing.title, to: title };
  if (existing.content !== content) changes.content = { from: existing.content, to: content };
  if (!sameChecklist) changes.checklist = { from: existingChecklist, to: checklist };
  if (!sameSubjects) changes.subject = { from: existingSubjects, to: subjects };
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
      checklist,
      subject: subjects,
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
    // The post update already succeeded. Do not tell the admin that saving
    // failed and invite a duplicate retry just because edit-history storage
    // is unavailable or its migration is missing.
    console.error("[updatePost] edit history insert failed", editError);
  }

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/your-progress");
  revalidatePath("/due-soon");
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
  revalidatePath("/your-progress");
  revalidatePath("/due-soon");
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
