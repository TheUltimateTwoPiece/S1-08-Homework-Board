import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const getCachedProfile = unstable_cache(
    async (userId: string) => {
      const client = await createClient();
      const { data: profile } = await client
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      return profile;
    },
    ["profile"],
    { revalidate: 300 }
  );

  return await getCachedProfile(user.id);
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const getCachedCount = unstable_cache(
    async (uid: string) => {
      const client = await createClient();
      const { count } = await client
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", uid)
        .is("read_at", null);
      return count ?? 0;
    },
    ["notification-count"],
    { revalidate: 30 }
  );

  return await getCachedCount(userId);
}
