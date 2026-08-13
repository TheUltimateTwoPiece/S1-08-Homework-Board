"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveCompletionAction } from "@/lib/completions";

export async function togglePostComplete(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const postIdValue = formData.get("postId");
  const postId = typeof postIdValue === "string" ? postIdValue.trim() : "";
  const completedValue = formData.get("completed");
  const desiredCompleted = completedValue === "true"
    ? true
    : completedValue === "false"
      ? false
      : null;

  if (!postId) return;

  // An explicit desired state makes retries and double-clicks idempotent.
  // The legacy toggle behavior is retained for callers that do not send it.
  // Look-then-insert/delete still has a TOCTOU race, so unique conflicts are
  // handled as successful no-ops below.
  //
  // Look-then-insert/delete has a TOCTOU race: two rapid clicks fire this
  // action twice in parallel, both see `existing` as null, both try to
  // insert, and the second one crashes on the (post_id, user_id) unique
  // constraint. We handle that gracefully below instead of throwing.
  const { data: existing } = await supabase
    .from("post_completions")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  const decision = resolveCompletionAction(Boolean(existing), desiredCompleted);

  if (decision.action === "complete") {
    if (!existing) {
      const { error } = await supabase.from("post_completions").insert({
        post_id: postId,
        user_id: user.id,
      });

      // Unique-constraint violation (Postgres 23505) means another
      // concurrent insert won the race — treat as a successful no-op
      // rather than crashing the action.
      if (error && error.code !== "23505") {
        throw new Error(error.message);
      }
    }
  } else if (decision.action === "uncomplete" && existing) {
    const { error } = await supabase
      .from("post_completions")
      .delete()
      .eq("id", existing.id);

    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath("/");
  revalidatePath(`/posts/${postId}`);
  revalidatePath("/your-progress");
  revalidatePath("/due-soon");
}
