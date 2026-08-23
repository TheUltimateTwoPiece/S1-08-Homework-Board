"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tripProfanity } from "@/lib/profanity";

const MAX_NAME_LENGTH = 80;

type BirthdayPopupResult =
  | { success: true; active: boolean; name: string }
  | { success: false; error: string };

export async function saveBirthdayPopup(
  formData: FormData,
): Promise<BirthdayPopupResult> {
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

  const name = ((formData.get("celebrantName") as string | null) ?? "").trim();
  const active = formData.get("active") === "on";

  if (!name) {
    return { success: false, error: "Enter the birthday person's name." };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return {
      success: false,
      error: `The name is too long (max ${MAX_NAME_LENGTH} characters).`,
    };
  }

  const profanity = tripProfanity({ userId: user.id }, name);
  if (profanity.triggered) redirect(profanity.redirectUrl);

  const { data: existing } = await supabase
    .from("birthday_settings")
    .select("active, celebrant_name, activated_at")
    .eq("id", 1)
    .maybeSingle();

  const now = new Date().toISOString();
  const startsNewActivation =
    active &&
    (!existing?.active ||
      existing?.celebrant_name !== name ||
      !existing?.activated_at);
  const activatedAt = active
    ? startsNewActivation
      ? now
      : existing?.activated_at ?? now
    : existing?.activated_at ?? null;

  const { error } = await supabase.from("birthday_settings").upsert({
    id: 1,
    active,
    celebrant_name: name,
    // Keep the same activation marker when an admin saves unchanged settings
    // so users who already dismissed the popup do not see it again.
    activated_at: activatedAt,
    updated_at: now,
  });

  if (error) {
    return {
      success: false,
      error: `Couldn't save birthday popup settings: ${error.message}`,
    };
  }

  revalidatePath("/");
  revalidatePath("/admin");

  return { success: true, active, name };
}
