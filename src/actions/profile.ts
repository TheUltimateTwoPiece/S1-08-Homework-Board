"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB
const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const ACCEPTED_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type UpdateProfileResult =
  | { success: true; avatarUrl: string | null; fullName: string }
  | { success: false; error: string };

export async function updateProfile(
  formData: FormData,
): Promise<UpdateProfileResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const fullNameRaw = (formData.get("fullName") as string | null) ?? "";
  const fullName = fullNameRaw.trim();
  if (!fullName) {
    return { success: false, error: "Display name can't be empty." };
  }
  if (fullName.length > 80) {
    return { success: false, error: "Display name is too long (max 80 characters)." };
  }

  const emailPostNotifications =
    formData.get("emailPostNotifications") === "on";
  const emailReminderNotifications =
    formData.get("emailReminderNotifications") === "on";

  const removeAvatar = formData.get("removeAvatar") === "true";
  const avatarFile = formData.get("avatar");

  // Look up current profile so we can delete the previous avatar file
  // when the user replaces or removes it.
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .single();

  let nextAvatarUrl: string | null = currentProfile?.avatar_url ?? null;

  // 1. Handle explicit remove
  if (removeAvatar && currentProfile?.avatar_url) {
    await deleteAvatarByUrl(supabase, currentProfile.avatar_url);
    nextAvatarUrl = null;
  }

  // 2. Handle new upload (validates type/size, then writes to storage)
  if (
    avatarFile &&
    avatarFile instanceof File &&
    avatarFile.size > 0 &&
    !removeAvatar
  ) {
    if (avatarFile.size > MAX_AVATAR_BYTES) {
      return {
        success: false,
        error: `Avatar is too large (${Math.round(avatarFile.size / 1024)} KB). Max 2 MB.`,
      };
    }
    if (!ACCEPTED_TYPES.has(avatarFile.type)) {
      return {
        success: false,
        error: "Avatar must be a JPG, PNG, WebP, or GIF image.",
      };
    }

    const ext = ACCEPTED_EXTENSIONS[avatarFile.type];
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });

    if (uploadError) {
      return {
        success: false,
        error: `Couldn't upload avatar: ${uploadError.message}`,
      };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);

    // Clean up the previous file (best effort — don't fail the save if delete fails).
    if (currentProfile?.avatar_url) {
      await deleteAvatarByUrl(supabase, currentProfile.avatar_url);
    }

    nextAvatarUrl = publicUrl;
  }

  // Save name + avatar first. These columns have existed since schema.sql so
  // they're guaranteed to exist on every install regardless of migration
  // state. Splitting the writes lets us degrade gracefully if the email-
  // preferences migration hasn't run yet.
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ full_name: fullName, avatar_url: nextAvatarUrl })
    .eq("id", user.id);

  if (updateError) {
    return {
      success: false,
      error: `Couldn't save profile: ${updateError.message}`,
    };
  }

  // Email preference columns were added in migration-profile-email-prefs.sql.
  // If the migration hasn't run yet, the column is missing — PostgREST
  // returns "Could not find the '...' column". Tolerate that case so the
  // avatar + name still save on partial installs; surface any other error.
  const { error: prefError } = await supabase
    .from("profiles")
    .update({
      email_post_notifications: emailPostNotifications,
      email_reminder_notifications: emailReminderNotifications,
    })
    .eq("id", user.id);

  if (
    prefError &&
    !/column.*does not exist|could not find the.*column of.*in the schema cache/i.test(prefError.message)
  ) {
    return {
      success: false,
      error: `Couldn't save email preferences: ${prefError.message}`,
    };
  }

  // Revalidate every page that shows a profile byline so the new name +
  // avatar appear immediately (otherwise stale revalidate windows would
  // hide the change for up to 30 seconds on the dashboard).
  revalidatePath("/");
  revalidatePath("/posts");
  revalidatePath("/posts/[id]", "page");
  revalidatePath("/your-progress");
  revalidatePath("/calendar");
  revalidatePath("/notifications");
  revalidatePath("/admin");
  revalidatePath("/admin/feedback");
  revalidatePath("/admin/schedule");
  revalidatePath("/feedback");
  revalidatePath("/settings");

  return {
    success: true,
    avatarUrl: nextAvatarUrl,
    fullName,
  };
}

/**
 * Best-effort delete of an avatar storage object by its public URL.
 * Silently ignores 404s (already gone) and other failures so a save
 * doesn't get blocked by cleanup issues.
 */
async function deleteAvatarByUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  url: string,
): Promise<void> {
  try {
    const marker = "/storage/v1/object/public/avatars/";
    const idx = url.indexOf(marker);
    if (idx === -1) return;
    const path = decodeURIComponent(url.slice(idx + marker.length));
    if (!path) return;
    await supabase.storage.from("avatars").remove([path]);
  } catch {
    // ignore
  }
}