import { Suspense } from "react";
import { SideRail } from "@/components/SideRail";
import { SideRailBadge } from "@/components/SideRailBadge";
import { PageTransition } from "@/components/PageTransition";
import { getCurrentProfile } from "@/lib/auth";
import type { Profile } from "@/lib/types";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile) {
    return <>{children}</>;
  }

  return (
    <div className="hb-app-shell">
      <SideRail
        profile={profile}
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
    </div>
  );
}

// Re-export the shape SideRail expects so we don't need a new type file.
export type SideRailProfile = Profile;