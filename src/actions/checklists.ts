"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { normalizeChecklist } from "@/lib/types";

export async function setChecklistItem(formData: FormData) {
  const profile = await requireProfile();
  const postIdValue = formData.get("postId");
  const itemIdValue = formData.get("itemId");
  const checked = formData.get("checked") === "true";
  const postId = typeof postIdValue === "string" ? postIdValue.trim() : "";
  const itemId = typeof itemIdValue === "string" ? itemIdValue.trim() : "";

  if (!postId || !itemId) return { success: false, error: "Missing checklist item." };

  const supabase = await createClient();
  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("checklist")
    .eq("id", postId)
    .single();

  if (postError || !post) return { success: false, error: "Post not found." };

  const itemExists = normalizeChecklist(post.checklist).some((item) => item.id === itemId);
  if (!itemExists) return { success: false, error: "Checklist item not found." };

  if (checked) {
    const { error } = await supabase
      .from("post_checklist_completions")
      .upsert(
        { post_id: postId, user_id: profile.id, item_id: itemId, completed_at: new Date().toISOString() },
        { onConflict: "post_id,user_id,item_id" },
      );
    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("post_checklist_completions")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", profile.id)
      .eq("item_id", itemId);
    if (error) return { success: false, error: error.message };
  }

  revalidatePath(`/posts/${postId}`);
  return { success: true, checked };
}
