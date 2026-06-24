import Link from "next/link";
import { signOut } from "@/actions/auth";
import { NotificationBell } from "@/components/NotificationBell";
import type { Profile } from "@/lib/types";

type HeaderProps = {
  profile: Profile;
  unreadCount: number;
};

export function Header({ profile, unreadCount }: HeaderProps) {
  return (
    <header className="hb-header">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <Link href="/" className="hb-brand text-lg font-semibold">
          S1-08 Homework Board
        </Link>

        <nav className="flex items-center gap-3 text-sm">
          <NotificationBell unreadCount={unreadCount} />

          {profile.role === "admin" && (
            <Link
              href="/admin"
              className="hb-btn-primary px-3 py-1.5 text-sm font-medium"
            >
              Create Post
            </Link>
          )}

          <span className="hb-text-subtle hidden sm:inline">
            {profile.full_name}
            {profile.role === "admin" && (
              <span className="hb-badge-admin ml-1 rounded px-1.5 py-0.5 text-xs font-medium">
                Admin
              </span>
            )}
          </span>

          <form action={signOut}>
            <button
              type="submit"
              className="hb-link-muted"
            >
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
