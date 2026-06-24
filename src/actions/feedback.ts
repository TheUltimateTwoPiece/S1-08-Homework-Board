"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function submitFeedback(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const message = (formData.get("message") as string | null)?.trim() ?? "";

  if (!message) {
    return { error: "Feedback cannot be empty." };
  }

  const { error } = await supabase.from("feedback").insert({
    author_id: user.id,
    message,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/feedback");
  return { success: true };
}
