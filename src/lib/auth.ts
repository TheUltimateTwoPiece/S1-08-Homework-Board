import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/**
 * Reads the current authenticated profile. Wrapped in React `cache()` so that
 * if multiple server components in the same request call this, only ONE
 * Supabase round-trip happens (otherwise every nested RSC re-fetches the
 * profile from scratch, multiplying navigation latency).
 */
export const getCurrentProfile = cache(
  async (): Promise<Profile | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    return profile;
  },
);

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

/**
 * Counts unread notifications. Wrapped in React `cache()` so multiple
 * calls in one request share the same round-trip.
 */
export const getUnreadNotificationCount = cache(
  async (userId: string): Promise<number> => {
    const supabase = await createClient();
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null);

    return count ?? 0;
  },
);

export type AdminInboxCounts = {
  feedback: number;
  bugReports: number;
};

/** Counts items that still need an admin's attention in the two admin inboxes. */
export const getAdminInboxCounts = cache(
  async (): Promise<AdminInboxCounts> => {
    const supabase = await createClient();
    const [{ count: feedback }, { count: bugReports }] = await Promise.all([
      supabase
        .from("feedback")
        .select("id", { count: "exact", head: true })
        .eq("status", "unread"),
      supabase
        .from("bug_reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "unread"),
    ]);

    return {
      feedback: feedback ?? 0,
      bugReports: bugReports ?? 0,
    };
  },
);