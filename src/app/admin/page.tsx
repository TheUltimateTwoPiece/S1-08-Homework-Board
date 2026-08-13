import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { CreatePostForm } from "@/components/CreatePostForm";
import { SendReminderForm } from "@/components/SendReminderForm";
import type { Post, Profile } from "@/lib/types";

export const revalidate = 60;

export default async function AdminPage() {
  const profile = await requireProfile();

  if (profile.role !== "admin") {
    redirect("/");
  }

  const supabase = await createClient();

  const [{ data: students }, { data: admins }, { data: posts }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "student")
      .order("full_name"),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "admin")
      .order("full_name"),
    supabase
      .from("posts")
      .select("id, title")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-blue-700" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
            </svg>
          </div>
          <div>
            <h1 className="hb-page-title text-2xl tracking-tight">Admin panel</h1>
            <p className="hb-body-text mt-0.5 text-sm">
              Post daily homework and send reminders so students complete their work.
            </p>
          </div>
        </div>

        {/* Admin sub-navigation */}
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/admin/feedback"
            className="hb-card-section inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Feedback inbox
          </Link>
          <Link
            href="/admin/bug-reports"
            className="hb-card-section inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
              <path d="M8 8h8" />
              <path d="M8 12h8" />
              <path d="M8 16h5" />
            </svg>
            Bug report inbox
          </Link>
          <Link
            href="/admin/analytics"
            className="hb-card-section inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <path d="M4 19V5" />
              <path d="M4 19h17" />
              <rect x="7" y="12" width="2.5" height="4" rx="0.5" />
              <rect x="11.5" y="9" width="2.5" height="7" rx="0.5" />
              <rect x="16" y="5" width="2.5" height="11" rx="0.5" />
            </svg>
            Analytics
          </Link>
          <Link
            href="/admin/pip-stats"
            className="hb-card-section inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <rect x="9" y="9" width="6" height="6" rx="1" />
              <path d="M9 2v2" /><path d="M15 2v2" />
              <path d="M9 20v2" /><path d="M15 20v2" />
              <path d="M20 9h2" /><path d="M2 9h2" />
              <path d="M20 15h2" /><path d="M2 15h2" />
            </svg>
            Pip Stats
          </Link>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <CreatePostForm />
        <SendReminderForm
          students={(students as Profile[]) ?? []}
          admins={(admins as Profile[]) ?? []}
          posts={(posts as Pick<Post, "id" | "title">[]) ?? []}
          // Pass env-driven test-mode state down so the form can surface a
          // persistent pre-click banner (rather than after the action fires).
          brevoTestMode={Boolean(process.env.BREVO_TEST_TO_EMAIL)}
          brevoTestModeEmail={process.env.BREVO_TEST_TO_EMAIL ?? null}
        />
      </div>
    </div>
  );
}
