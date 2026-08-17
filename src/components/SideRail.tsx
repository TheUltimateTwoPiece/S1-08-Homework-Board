"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode, MouseEvent as ReactMouseEvent } from "react";
import { signOut } from "@/actions/auth";
import { Avatar } from "@/components/Avatar";
import { PendingButton } from "@/components/PendingButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Profile } from "@/lib/types";

type SideRailProps = {
  profile: Profile;
  unreadBadgeSlot?: ReactNode;
  adminInboxCounts?: {
    feedback: number;
    bugReports: number;
  };
};

type RailItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  exactMatch?: boolean;
  adminOnly?: boolean;
  inbox?: "feedback" | "bugReports";
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
      className="h-5 w-5"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// Core navigation: the things students reach for every day.
const MAIN_NAV: RailItem[] = [
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
    href: "/posts",
    label: "All posts",
    icon: (
      <Icon>
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </Icon>
    ),
  },
  {
    href: "/pip",
    label: "Pip",
    icon: (
      <Icon>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <rect x="9" y="9" width="6" height="6" rx="1" />
        <path d="M9 2v2" /><path d="M15 2v2" />
        <path d="M9 20v2" /><path d="M15 20v2" />
        <path d="M20 9h2" /><path d="M2 9h2" />
        <path d="M20 15h2" /><path d="M2 15h2" />
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
];

// Utility links students use occasionally, kept separate from the daily nav.
const MORE_NAV: RailItem[] = [
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
    href: "/bug-report",
    label: "Report a bug",
    icon: (
      <Icon>
        <path d="M10.3 2.8 1.8 17.5A2 2 0 0 0 3.5 20.5h17a2 2 0 0 0 1.7-3L13.7 2.8a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
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
    href: "/admin/announcements",
    label: "Announcements",
    icon: (
      <Icon>
        <path d="M3 11v3a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1z" />
        <path d="M15 8a4 4 0 0 1 0 8" />
      </Icon>
    ),
    adminOnly: true,
  },
  {
    href: "/admin/schedule",
    label: "Schedule",
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </Icon>
    ),
    adminOnly: true,
  },
  {
    href: "/admin/pip-stats",
    label: "Pip Stats",
    icon: (
      <Icon>
        <path d="M4 19V5" />
        <path d="M4 19h17" />
        <rect x="7" y="12" width="2.5" height="4" rx="0.5" />
        <rect x="11.5" y="9" width="2.5" height="7" rx="0.5" />
        <rect x="16" y="5" width="2.5" height="11" rx="0.5" />
      </Icon>
    ),
    adminOnly: true,
  },
  {
    href: "/admin/feedback",
    label: "Feedback inbox",
    icon: (
      <Icon>
        <path d="M22 12h-6l-2 3h-4l-2-3H2" />
        <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      </Icon>
    ),
    adminOnly: true,
    inbox: "feedback",
  },
  {
    href: "/admin/bug-reports",
    label: "Bug report inbox",
    icon: (
      <Icon>
        <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
        <path d="M8 8h8" />
        <path d="M8 12h8" />
        <path d="M8 16h5" />
      </Icon>
    ),
    adminOnly: true,
    inbox: "bugReports",
  },
];

function InboxStatusBadge({ count }: { count: number }) {
  const label = count > 0
    ? `${count > 99 ? "99+" : count} new`
    : "Clear";
  return (
    <span
      className={`hb-siderail-admin-status ${count > 0 ? "hb-siderail-admin-status--new" : "hb-siderail-admin-status--clear"}`}
      aria-label={count > 0 ? `${count} unread` : "No unread items"}
    >
      {label}
    </span>
  );
}

// Routes the user hits often — prefetch the full RSC payload eagerly so the
// first click feels instant. Other routes use Next's default "auto"
// (prefetched when scrolled into viewport), which is plenty for less-used
// destinations.
const EAGER_PREFETCH = new Set<string>(["/", "/calendar", "/admin"]);

function mobilePageTitle(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  if (pathname === "/posts" || pathname.startsWith("/posts/")) return "Homework";
  if (pathname === "/calendar") return "Calendar";
  if (pathname === "/pip") return "Pip";
  if (pathname === "/your-progress") return "Your progress";
  if (pathname === "/notifications") return "Reminders";
  if (pathname === "/settings") return "Settings";
  if (pathname === "/feedback") return "Feedback";
  if (pathname === "/bug-report") return "Report a bug";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "Admin";
  return "Homework Board";
}

export function SideRail({ profile, unreadBadgeSlot, adminInboxCounts }: SideRailProps) {
  const pathname = usePathname();
  const [pulsedHref, setPulsedHref] = useState<string | null>(null);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const mobileMenuOpenRef = useRef(false);
  const mobileTouchRef = useRef<{ x: number; y: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const adminMenuRef = useRef<HTMLDivElement | null>(null);

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
    if (!href.startsWith("/admin")) setAdminMenuOpen(false);
    mobileMenuOpenRef.current = false;
    setMobileMenuOpen(false);
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

  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  useEffect(() => {
    mobileMenuOpenRef.current = mobileMenuOpen;
  }, [mobileMenuOpen]);

  // On the first phone visit, nudge once toward the hidden swipe gesture. It
  // disappears after a few seconds and is never shown again this session, so
  // it stays a quiet affordance rather than an onboarding step.
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !window.matchMedia("(max-width: 768px)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    try {
      if (sessionStorage.getItem("hb-swipe-hint-shown")) return;
    } catch {
      return;
    }

    const showTimer = setTimeout(() => setShowSwipeHint(true), 500);
    const hideTimer = setTimeout(() => setShowSwipeHint(false), 4200);
    try {
      sessionStorage.setItem("hb-swipe-hint-shown", "1");
    } catch { /* sessionStorage can throw in private mode */ }
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  // A phone user can open the drawer by starting at the actual left edge,
  // not only by finding the hamburger button. The listeners live on window so
  // the gesture works anywhere along the page, including below the header.
  useEffect(() => {
    function isMobileViewport() {
      return typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;
    }

    function handleTouchStart(event: TouchEvent) {
      if (!isMobileViewport()) return;
      const touch = event.touches[0];
      if (!touch) return;
      const drawerWidth = Math.min(window.innerWidth * 0.84, 320);
      const startsAtEdge = touch.clientX <= 28;
      const startsInOpenDrawer = mobileMenuOpenRef.current && touch.clientX <= drawerWidth;
      if (startsAtEdge || startsInOpenDrawer) {
        mobileTouchRef.current = { x: touch.clientX, y: touch.clientY };
      }
    }

    function handleTouchEnd(event: TouchEvent) {
      const start = mobileTouchRef.current;
      const touch = event.changedTouches[0];
      mobileTouchRef.current = null;
      if (!start || !touch || !isMobileViewport()) return;

      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      const isHorizontalSwipe = Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.15;
      if (!isHorizontalSwipe) return;

      if (!mobileMenuOpenRef.current && start.x <= 28 && dx > 0) {
        mobileMenuOpenRef.current = true;
        setMobileMenuOpen(true);
      } else if (mobileMenuOpenRef.current && dx < 0) {
        mobileMenuOpenRef.current = false;
        setMobileMenuOpen(false);
      }
    }

    function handleTouchCancel() {
      mobileTouchRef.current = null;
    }

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchCancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchCancel);
    };
  }, []);

  // Close the mobile drawer with Escape as well as the admin flyout. The
  // drawer is deliberately mobile-only; desktop keeps the icon rail exactly
  // as it was.
  useEffect(() => {
    if (!mobileMenuOpen) return;

    function handleMobileKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        mobileMenuOpenRef.current = false;
        setMobileMenuOpen(false);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleMobileKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleMobileKeyDown);
    };
  }, [mobileMenuOpen]);

  // Close the flyout when focus moves elsewhere or Escape is pressed. This
  // keeps the compact rail from leaving an overlay stranded over page content.
  useEffect(() => {
    if (!adminMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!adminMenuRef.current?.contains(event.target as Node)) {
        setAdminMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setAdminMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [adminMenuOpen]);

  const renderItem = (item: RailItem) => {
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
  };

  return (
    <aside
      className={`hb-siderail ${mobileMenuOpen ? "hb-siderail--mobile-open" : ""}`}
      aria-label="Primary navigation"
    >
      <div className="hb-mobile-topbar">
        <button
          type="button"
          className="hb-mobile-menu-button"
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileMenuOpen}
          aria-controls="hb-primary-navigation"
          onClick={() => {
            mobileMenuOpenRef.current = !mobileMenuOpenRef.current;
            setMobileMenuOpen((open) => !open);
          }}
        >
          {mobileMenuOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="m6 6 12 12" />
              <path d="m18 6-12 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16" />
              <path d="M4 12h16" />
              <path d="M4 18h16" />
            </svg>
          )}
        </button>
        <span className="hb-mobile-topbar-title">{mobilePageTitle(pathname)}</span>
        <Link
          href="/notifications"
          className="hb-mobile-notifications"
          aria-label="Reminders"
          onClick={() => {
            mobileMenuOpenRef.current = false;
            setMobileMenuOpen(false);
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unreadBadgeSlot}
        </Link>
      </div>
      {showSwipeHint && !mobileMenuOpen && (
        <div className="hb-mobile-swipe-hint" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 6 15 12 9 18" />
          </svg>
          <span>Swipe for menu</span>
        </div>
      )}
      {!mobileMenuOpen && (
        <div className="hb-mobile-swipe-zone" aria-hidden="true" />
      )}
      {mobileMenuOpen && (
        <button
          type="button"
          className="hb-mobile-nav-backdrop"
          aria-label="Close navigation menu"
          onClick={() => {
            mobileMenuOpenRef.current = false;
            setMobileMenuOpen(false);
          }}
        />
      )}
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
          strokeWidth="2"
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

      <nav id="hb-primary-navigation" className="hb-siderail-nav" onClick={handleNavClick}>
        {MAIN_NAV.map(renderItem)}
        <div className="hb-siderail-group-divider" aria-hidden="true" />
        {MORE_NAV.map(renderItem)}

        {profile.role === "admin" && (
          <div className="hb-siderail-admin-group" ref={adminMenuRef}>
            <button
              type="button"
              className={`hb-siderail-btn hb-siderail-admin-toggle ${isAdminRoute || adminMenuOpen ? "hb-siderail-btn--active" : ""}`}
              aria-label="Admin tools"
              aria-expanded={adminMenuOpen}
              aria-controls="hb-siderail-admin-menu"
              onClick={(event) => {
                event.stopPropagation();
                setAdminMenuOpen((open) => !open);
              }}
            >
              <Icon>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </Icon>
              <span className="hb-siderail-tooltip">Admin tools</span>
            </button>

            {adminMenuOpen && (
              <div id="hb-siderail-admin-menu" className="hb-siderail-admin-menu" role="menu">
                <div className="hb-siderail-admin-menu-title">Admin tools</div>
                <div className="hb-siderail-admin-section-label">Workspace</div>
                {ADMIN_NAV_ITEMS.map((item, index) => {
                  const isActive = activeFor(item.href, item.exactMatch);
                  const showInboxHeading = item.inbox && !ADMIN_NAV_ITEMS[index - 1]?.inbox;
                  const count = item.inbox === "feedback"
                    ? adminInboxCounts?.feedback ?? 0
                    : item.inbox === "bugReports"
                      ? adminInboxCounts?.bugReports ?? 0
                      : 0;
                  return (
                    <div key={item.href}>
                      {showInboxHeading && <div className="hb-siderail-admin-section-label hb-siderail-admin-section-label--inbox">Inboxes</div>}
                      <Link
                        href={item.href}
                        prefetch={EAGER_PREFETCH.has(item.href) ? true : undefined}
                        role="menuitem"
                        aria-current={isActive ? "page" : undefined}
                        className={`hb-siderail-admin-link ${isActive ? "hb-siderail-admin-link--active" : ""}`}
                        onClick={() => {
                          setAdminMenuOpen(false);
                          mobileMenuOpenRef.current = false;
                          setMobileMenuOpen(false);
                        }}
                      >
                        {item.icon}
                        <span className="hb-siderail-admin-link-label">{item.label}</span>
                        {item.inbox && <InboxStatusBadge count={count} />}
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </nav>

      <div className="hb-siderail-footer">
        <ThemeToggle />
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