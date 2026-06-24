"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function normalizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-");
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
    const uploads: {
      uploader_id: string;
      comment_id: string;
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
      const path = `comments/${comment.id}/${crypto.randomUUID()}-${normalizeFileName(file.name)}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, { contentType: file.type });

      if (uploadError) {
        if (uploads.length > 0) {
          await supabase.storage
            .from("attachments")
            .remove(uploads.map((upload) => upload.path));
        }
        await supabase.from("comments").delete().eq("id", comment.id);
        return { error: uploadError.message };
      }

      uploads.push({
        uploader_id: user.id,
        comment_id: comment.id,
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
      await supabase.storage
        .from("attachments")
        .remove(uploads.map((upload) => upload.path));
      await supabase.from("comments").delete().eq("id", comment.id);
      return { error: attachmentError.message };
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

  const query = supabase.from("comments").delete().eq("id", commentId);

  if (!isAdmin) {
    query.eq("author_id", user.id);
  }

  const { error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/posts/${postId}`);
}
