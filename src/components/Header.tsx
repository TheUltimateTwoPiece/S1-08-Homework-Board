"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/actions/auth";
import { NotificationBell } from "@/components/NotificationBell";
import { PendingButton } from "@/components/PendingButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Profile } from "@/lib/types";

type HeaderProps = {
  profile: Profile;
  unreadCount: number;
};

export function Header({ profile, unreadCount }: HeaderProps) {
  const pathname = usePathname();

  function isActive(path: string) {
    return pathname === path ? "bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-slate-100" : "hb-link-muted hover:bg-slate-100 dark:hover:bg-slate-700";
  }

  return (
    <header className="hb-header">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-3 py-2.5 sm:px-4 sm:py-3">
        <Link href="/" className="hb-brand flex items-center gap-2 text-base font-bold tracking-tight sm:text-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 text-slate-500 sm:h-5 sm:w-5"
            aria-hidden="true"
          >
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 1 4 19.5" />
            <path d="M9 10h6" />
            <path d="M9 14h6" />
            <path d="M9 6h6" />
          </svg>
          <span className="hidden sm:inline">S1-08 Homework</span>
          <span className="sm:hidden">Homework</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm sm:gap-2">
          <ThemeToggle />

          <NotificationBell unreadCount={unreadCount} />

          <Link
            href="/calendar"
            className={`rounded-lg px-2 py-1.5 text-xs font-medium transition sm:px-3 sm:text-sm ${isActive("/calendar")}`}
          >
            Calendar
          </Link>

          {profile.role === "admin" && (
            <>
              <Link
                href="/admin/schedule"
                className={`rounded-lg px-2 py-1.5 text-xs font-medium transition sm:px-3 sm:text-sm ${isActive("/admin/schedule")}`}
              >
                Schedule
              </Link>
              <Link
                href="/admin"
                className={`rounded-lg px-2 py-1.5 text-xs font-medium transition sm:px-3 sm:text-sm ${isActive("/admin")}`}
              >
                <span className="hidden sm:inline">Admin</span>
                <span className="sm:hidden">Panel</span>
              </Link>
            </>
          )}

          <div className="ml-1 flex items-center gap-1 border-l border-slate-200 pl-2 dark:border-slate-600 sm:gap-2 sm:pl-3">
            <span className="hidden items-center gap-1.5 sm:flex">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {profile.full_name.split(" ")[0]}
              </span>
              {profile.role === "admin" && (
                <span className="hb-badge-admin rounded px-1.5 py-0.5 text-[10px] font-semibold">Admin</span>
              )}
            </span>

            <form action={signOut}>
              <PendingButton
                type="submit"
                pendingContent="..."
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </PendingButton>
            </form>
          </div>
        </nav>
      </div>
    </header>
  );
}
