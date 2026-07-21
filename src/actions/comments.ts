"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

export async function addComment(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const postId = formData.get("postId") as string;
  const parentCommentId = (formData.get("parentCommentId") as string | null) ?? "";
  const content = ((formData.get("content") as string | null) ?? "").trim();
  const files = (formData.getAll("files") as File[]).filter((file) => file.size > 0);

  if (!postId) {
    return { error: "Post not found." };
  }

  if (!content) {
    return { error: "Comment cannot be empty." };
  }

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("comments_locked")
    .eq("id", postId)
    .single();

  if (postError || !post) {
    return { error: "Post not found." };
  }

  if (post.comments_locked) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return { error: "Comments are locked for this post." };
    }
  }

  const { data: comment, error } = await supabase
    .from("comments")
    .insert({
      post_id: postId,
      parent_comment_id: parentCommentId ? parentCommentId : null,
      author_id: user.id,
      content,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  if (comment && files.length > 0) {
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
      (file) =>
        `comments/${comment.id}/${crypto.randomUUID()}-${normalizeFileName(file.name)}`,
    );

    // Upload all files in parallel — was sequential before, which stalled
    // the request when multiple files were attached.
    const uploadResults = await Promise.all(
      files.map((file, i) =>
        supabase.storage
          .from(bucket)
          .upload(paths[i], file, { contentType: file.type })
          .then(({ error }) => ({ error, path: paths[i] })),
      ),
    );

    const failed = uploadResults.find((r) => r.error);
    if (failed) {
      const successfulPaths = uploadResults
        .filter((r) => !r.error)
        .map((r) => r.path);
      if (successfulPaths.length > 0) {
        await supabase.storage.from(bucket).remove(successfulPaths);
      }
      await supabase.from("comments").delete().eq("id", comment.id);
      return { error: normalizeStorageError(failed.error!.message) };
    }

    const uploads = files.map((file, i) => ({
      uploader_id: user.id,
      comment_id: comment.id,
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
      await supabase.from("comments").delete().eq("id", comment.id);
      return { error: normalizeDatabaseError(attachmentError.message) };
    }
  }

  revalidatePath(`/posts/${postId}`);
  return { success: true };
}

export async function deleteComment(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const commentId = formData.get("commentId") as string;
  const postId = formData.get("postId") as string;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";

  // Fetch the comment's attachments BEFORE deleting the row, so we can
  // clean up the physical storage objects. Otherwise deleting the
  // comment leaves orphaned files in the attachments bucket.
  const { data: attachments } = await supabase
    .from("attachments")
    .select("bucket, path")
    .eq("comment_id", commentId);

  const query = supabase.from("comments").delete().eq("id", commentId);

  if (!isAdmin) {
    query.eq("author_id", user.id);
  }

  const { error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  // Best-effort storage cleanup — never block the revalidate on this.
  if (attachments && attachments.length > 0) {
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

  revalidatePath(`/posts/${postId}`);
}
