import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Profile } from "@/lib/types";

type PageTopBarProps = {
  profile: Profile;
  greetingName: string;
  subtitle?: string;
  showAdminCta?: boolean;
};

export function PageTopBar({
  profile,
  greetingName,
  subtitle,
  showAdminCta = false,
}: PageTopBarProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 flex-1">
        <h1 className="hb-page-title text-2xl tracking-tight sm:text-[28px]">
          Hi, <span className="text-blue-600 dark:text-blue-400">{greetingName}</span>!
          <span className="ml-2 inline-block origin-[70%_70%] animate-[hb-wave_1800ms_ease-in-out_infinite]">
            👋
          </span>
        </h1>
        <p className="hb-body-text mt-1 text-sm">
          {subtitle}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle />
        {showAdminCta && profile.role === "admin" && (
          <Link
            href="/admin"
            className="hb-btn-primary gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            <span className="hidden sm:inline">New post</span>
          </Link>
        )}
      </div>
    </div>
  );
}
