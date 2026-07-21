"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode, MouseEvent as ReactMouseEvent } from "react";
import { signOut } from "@/actions/auth";
import { Avatar } from "@/components/Avatar";
import { PendingButton } from "@/components/PendingButton";
import type { Profile } from "@/lib/types";

type SideRailProps = {
  profile: Profile;
  unreadBadgeSlot?: ReactNode;
};

type RailItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  exactMatch?: boolean;
  adminOnly?: boolean;
};

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const NAV_ITEMS: RailItem[] = [
  {
    href: "/",
    label: "Home",
    icon: (
      <Icon>
        <path d="M3 9 12 2l9 7v11a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z" />
      </Icon>
    ),
    exactMatch: true,
  },
  {
    href: "/calendar",
    label: "Calendar",
    icon: (
      <Icon>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </Icon>
    ),
  },
  {
    href: "/your-progress",
    label: "Your progress",
    icon: (
      <Icon>
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </Icon>
    ),
  },
  {
    href: "/notifications",
    label: "Notifications",
    icon: (
      <Icon>
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </Icon>
    ),
  },
  {
    href: "/posts",
    label: "All posts",
    icon: (
      <Icon>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="16" y2="17" />
      </Icon>
    ),
  },
  {
    href: "/feedback",
    label: "Feedback",
    icon: (
      <Icon>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </Icon>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </Icon>
    ),
  },
];

const ADMIN_NAV_ITEMS: RailItem[] = [
  {
    href: "/admin",
    label: "Admin",
    exactMatch: true,
    icon: (
      <Icon>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </Icon>
    ),
    adminOnly: true,
  },
  {
    href: "/admin/schedule",
    label: "Schedule",
    icon: (
      <Icon>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="m9 16 2 2 4-4" strokeWidth="1.5" />
      </Icon>
    ),
    adminOnly: true,
  },
  {
    href: "/admin/feedback",
    label: "Inbox",
    icon: (
      <Icon>
        <path d="M22 12h-6l-2 3h-4l-2-3H2" />
        <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      </Icon>
    ),
    adminOnly: true,
  },
];

// Routes the user hits often — prefetch the full RSC payload eagerly so the
// first click feels instant. Other routes use Next's default "auto"
// (prefetched when scrolled into viewport), which is plenty for less-used
// destinations.
const EAGER_PREFETCH = new Set<string>(["/", "/calendar", "/admin"]);

export function SideRail({ profile, unreadBadgeSlot }: SideRailProps) {
  const pathname = usePathname();
  const [pulsedHref, setPulsedHref] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function activeFor(path: string, exact?: boolean) {
    if (exact) return pathname === path;
    return pathname === path || pathname.startsWith(`${path}/`);
  }

  // Single delegated click handler attached to the parent <nav>. Reads the
  // href off the closest <a>, so each Link doesn't need its own onClick
  // closure (one closure per nav render, not per Link per render).
  const handleNavClick = useCallback((e: ReactMouseEvent<HTMLElement>) => {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }
    const anchor = (e.target as HTMLElement | null)?.closest("a");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setPulsedHref(href);
    timerRef.current = setTimeout(() => {
      setPulsedHref(null);
      timerRef.current = null;
    }, 600);
  }, []);

  // Clear any pending pulse timer when the siderail unmounts (e.g. on
  // sign-out) so we don't call setPulsedHref on an unmounted component.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const allItems =
    profile.role === "admin"
      ? [...NAV_ITEMS, ...ADMIN_NAV_ITEMS]
      : NAV_ITEMS;

  return (
    <aside className="hb-siderail" aria-label="Primary navigation">
      <Link
        href="/"
        className="hb-siderail-brand"
        aria-label="Homework Board home"
        prefetch={true}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 1 4 19.5" />
          <path d="M9 10h6" />
          <path d="M9 14h6" />
          <path d="M9 6h6" />
        </svg>
      </Link>

      <div className="hb-siderail-divider" />

      <nav className="hb-siderail-nav" onClick={handleNavClick}>
        {allItems.map((item) => {
          const isActive = activeFor(item.href, item.exactMatch);
          const isPulsed = pulsedHref === item.href;
          const eager = EAGER_PREFETCH.has(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={eager ? true : undefined}
              className={`hb-siderail-btn ${isActive ? "hb-siderail-btn--active" : ""} ${isPulsed ? "hb-siderail-btn--pulse" : ""}`}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
            >
              {item.icon}
              {item.href === "/notifications" && unreadBadgeSlot}
              <span className="hb-siderail-tooltip">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="hb-siderail-footer">
        <Link
          href="/settings"
          aria-label={`${profile.full_name} — open settings`}
          className="hb-siderail-avatar-link group"
        >
          <Avatar
            id={profile.id}
            name={profile.full_name}
            src={profile.avatar_url}
            size="md"
            className="ring-2 ring-white transition group-hover:ring-blue-200"
          />
        </Link>
        <form action={signOut}>
          <PendingButton
            type="submit"
            pendingContent="..."
            aria-label="Sign out"
            className="hb-siderail-btn hb-siderail-logout"
          >
            <Icon>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </Icon>
          </PendingButton>
        </form>
      </div>
    </aside>
  );
}