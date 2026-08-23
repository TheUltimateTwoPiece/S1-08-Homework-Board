import { Suspense } from "react";
import { BirthdayPopup } from "@/components/BirthdayPopup";
import { SideRail } from "@/components/SideRail";
import { SideRailBadge } from "@/components/SideRailBadge";
import { PageTransition } from "@/components/PageTransition";
import { getAdminInboxCounts, getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { BirthdaySetting, Profile } from "@/lib/types";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile) {
    return <>{children}</>;
  }

  const supabase = await createClient();
  const [{ data: birthdaySetting }, adminInboxCounts] = await Promise.all([
    supabase
      .from("birthday_settings")
      .select("id, active, celebrant_name, activated_at, updated_at")
      .eq("id", 1)
      .maybeSingle(),
    profile.role === "admin" ? getAdminInboxCounts() : Promise.resolve(undefined),
  ]);

  return (
    <div className="hb-app-shell">
      <SideRail
        profile={profile}
        adminInboxCounts={adminInboxCounts}
        unreadBadgeSlot={
          <Suspense
            fallback={
              <span
                className="hb-siderail-btn-badge-skeleton"
                aria-hidden="true"
              />
            }
          >
            <SideRailBadge userId={profile.id} />
          </Suspense>
        }
      />
      <main className="hb-app-main hb-main flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
      <BirthdayPopup
        setting={(birthdaySetting as BirthdaySetting | null) ?? null}
        userId={profile.id}
      />
    </div>
  );
}

// Re-export the shape SideRail expects so we don't need a new type file.
export type SideRailProfile = Profile;