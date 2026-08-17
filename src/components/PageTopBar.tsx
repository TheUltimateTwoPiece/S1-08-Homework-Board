import Link from "next/link";
import type { Profile } from "@/lib/types";

type PageTopBarProps = {
  profile: Profile;
  greetingName: string;
  subtitle?: string;
  showAdminCta?: boolean;
  showPipCta?: boolean;
};

export function PageTopBar({
  profile,
  greetingName,
  subtitle,
  showAdminCta = false,
  showPipCta = false,
}: PageTopBarProps) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 flex-1">
        <h1 className="hb-page-title text-2xl tracking-tight sm:text-[28px]">
          Hi, {greetingName}
        </h1>
        {subtitle && <p className="hb-body-text mt-1 text-sm">{subtitle}</p>}
      </div>
      <div className="hb-page-actions">
        {showPipCta && (
          <Link href="/pip" className="hb-page-action">
            Pip
          </Link>
        )}
        {showAdminCta && profile.role === "admin" && (
          <Link href="/admin" className="button gap-1.5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
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
