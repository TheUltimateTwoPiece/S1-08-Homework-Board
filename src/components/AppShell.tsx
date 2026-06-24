import { Header } from "@/components/Header";
import { getCurrentProfile, getUnreadNotificationCount } from "@/lib/auth";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile) {
    return <>{children}</>;
  }

  const [unreadCount] = await Promise.all([
    getUnreadNotificationCount(profile.id),
  ]);

  return (
    <>
      <Header profile={profile} unreadCount={unreadCount} />
      <main className="hb-main flex-1">{children}</main>
    </>
  );
}
