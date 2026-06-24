"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function normalizeMultilineText(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function normalizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-");
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
    const uploads: {
      uploader_id: string;
      post_id: string;
      bucket: string;
      path: string;
      original_name: string;
      mime_type: string;
      size_bytes: number;
    }[] = [];

    for (const file of files) {
      if (file.size > maxBytes) {
        return { error: `File "${file.name}" is too large.` };
      }

      const isAllowed =
        file.type === "application/pdf" || file.type.startsWith("image/");
      if (!isAllowed) {
        return { error: `File type not allowed: "${file.name}".` };
      }

      const bucket = "attachments";
      const path = `posts/${post.id}/${crypto.randomUUID()}-${normalizeFileName(file.name)}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, { contentType: file.type });

      if (uploadError) {
        return { error: uploadError.message };
      }

      uploads.push({
        uploader_id: user.id,
        post_id: post.id,
        bucket,
        path,
        original_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      });
    }

    const { error: attachmentError } = await supabase
      .from("attachments")
      .insert(uploads);

    if (attachmentError) {
      return { error: attachmentError.message };
    }
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/posts/[id]");
  return { success: true };
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

  const { error } = await supabase.from("posts").delete().eq("id", postId);

  if (error) {
    throw new Error(error.message);
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
