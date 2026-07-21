import { SideRail } from "@/components/SideRail";
import { PageTransition } from "@/components/PageTransition";
import { getCurrentProfile, getUnreadNotificationCount } from "@/lib/auth";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile) {
    return <>{children}</>;
  }

  const unreadCount = await getUnreadNotificationCount(profile.id);

  return (
    <div className="hb-app-shell">
      <SideRail profile={profile} unreadCount={unreadCount} />
      <main className="hb-app-main hb-main flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
