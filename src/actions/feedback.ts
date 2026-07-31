"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tripProfanity } from "@/lib/profanity";

export async function submitFeedback(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const categoryRaw = ((formData.get("category") as string | null) ?? "website").trim();
  const category = categoryRaw === "post" ? "post" : "website";
  const message = (formData.get("message") as string | null)?.trim() ?? "";

  if (!message) {
    return { error: "Feedback cannot be empty." };
  }

  // Profanity gate: feedback messages go through the same filter as
  // posts and comments so admins don't have to moderate what the
  // filter would have caught.
  const profanity = tripProfanity({ userId: user.id }, message);
  if (profanity.triggered) redirect(profanity.redirectUrl);

  const { error } = await supabase.from("feedback").insert({
    author_id: user.id,
    category,
    message,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/feedback");
  return { success: true };
}
