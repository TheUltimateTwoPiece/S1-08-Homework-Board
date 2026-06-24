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
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold text-slate-900">
          S1-08 Homework Board
        </Link>

        <nav className="flex items-center gap-3 text-sm">
          <NotificationBell unreadCount={unreadCount} />

          {profile.role === "admin" && (
            <Link
              href="/admin"
              className="rounded-lg bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700"
            >
              Create Post
            </Link>
          )}

          <span className="hidden text-slate-500 sm:inline">
            {profile.full_name}
            {profile.role === "admin" && (
              <span className="ml-1 rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-700">
                Admin
              </span>
            )}
          </span>

          <form action={signOut}>
            <button
              type="submit"
              className="text-slate-600 hover:text-slate-900"
            >
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
