import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { PageTopBar } from "@/components/PageTopBar";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const profile = await requireProfile();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <PageTopBar
        profile={profile}
        greetingName={profile.full_name}
        subtitle="Update how you appear across the homework board."
        showAdminCta={false}
      />

      <Link
        href="/theme-settings"
        className="group mb-6 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-blue-300 hover:shadow-sm"
      >
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-50 to-rose-50 text-blue-600"
            aria-hidden="true"
          >
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
              <circle cx="13.5" cy="6.5" r="2.5" />
              <circle cx="17.5" cy="10.5" r="2.5" />
              <circle cx="8.5" cy="7.5" r="2.5" />
              <circle cx="6.5" cy="12.5" r="2.5" />
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
            </svg>
          </span>
          <div>
            <div className="hb-card-section text-sm">Appearance & Themes</div>
            <div className="hb-card-meta mt-0.5 text-xs">
              Pick a preset or generate a theme from an image.
            </div>
          </div>
        </div>
        <span
          className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-600"
          aria-hidden="true"
        >
          →
        </span>
      </Link>

      <SettingsForm profile={profile} />
    </div>
  );
}