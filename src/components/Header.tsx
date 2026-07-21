"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/actions/auth";
import { NotificationBell } from "@/components/NotificationBell";
import { PendingButton } from "@/components/PendingButton";
import type { Profile } from "@/lib/types";

type HeaderProps = {
  profile: Profile;
  unreadCount: number;
};

export function Header({ profile, unreadCount }: HeaderProps) {
  const pathname = usePathname();

  return (
    <header className="hb-header">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/" className="hb-brand flex items-center gap-2 text-lg font-bold tracking-tight">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 text-slate-500"
            aria-hidden="true"
          >
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 1 4 19.5" />
            <path d="M9 10h6" />
            <path d="M9 14h6" />
            <path d="M9 6h6" />
          </svg>
          S1-08 Homework
        </Link>

        <nav className="flex items-center gap-2 text-sm">
          <NotificationBell unreadCount={unreadCount} />

          <Link
            href="/calendar"
            className={`rounded-lg px-3 py-1.5 font-medium transition ${
              pathname === "/calendar"
                ? "bg-slate-100 text-slate-900"
                : "hb-link-muted hover:bg-slate-100"
            }`}
          >
            Calendar
          </Link>

          {profile.role === "admin" && (
            <>
              <Link
                href="/admin/feedback"
                className={`rounded-lg px-3 py-1.5 font-medium transition ${
                  pathname === "/admin/feedback"
                    ? "bg-slate-100 text-slate-900"
                    : "hb-link-muted hover:bg-slate-100"
                }`}
              >
                Feedback
              </Link>
              <Link
                href="/admin"
                className="hb-btn-primary px-3 py-1.5 text-sm font-medium"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
                New Post
              </Link>
            </>
          )}

          <div className="ml-1 flex items-center gap-2 border-l border-slate-200 pl-3">
            <span className="hidden items-center gap-1.5 sm:flex">
              <span className="hb-text-muted text-xs font-medium">
                {profile.full_name}
              </span>
              {profile.role === "admin" && (
                <span className="hb-badge-admin rounded px-1.5 py-0.5 text-[10px] font-semibold">
                  Admin
                </span>
              )}
            </span>

            <form action={signOut}>
              <PendingButton
                type="submit"
                pendingContent="Signing out..."
                className="hb-link-muted flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition hover:bg-slate-100"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span className="hidden sm:inline">Sign out</span>
              </PendingButton>
            </form>
          </div>
        </nav>
      </div>
    </header>
  );
}
