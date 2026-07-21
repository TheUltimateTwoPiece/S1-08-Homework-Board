import { getUnreadNotificationCount } from "@/lib/auth";

type SideRailBadgeProps = {
  userId: string;
};

/**
 * Server component that fetches the unread-notification count and renders
 * the siderail badge. Designed to be wrapped in <Suspense> by AppShell so the
 * count query never blocks the initial paint of the siderail shell.
 */
export async function SideRailBadge({ userId }: SideRailBadgeProps) {
  const unread = await getUnreadNotificationCount(userId);
  if (unread <= 0) return null;
  return (
    <span
      className="hb-siderail-btn-badge"
      aria-label={`${unread} unread`}
    >
      {unread > 99 ? "99+" : unread}
    </span>
  );
}