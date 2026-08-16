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
        <div className="border-b pb-4">
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
            href="/admin/announcements"
            className="hb-page-action"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <path d="M3 11v3a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1z" />
              <path d="M15 8a4 4 0 0 1 0 8" />
            </svg>
            Announcements
          </Link>
          <Link
            href="/admin/feedback"
            className="hb-page-action"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Feedback inbox
          </Link>
          <Link
            href="/admin/bug-reports"
            className="hb-page-action"
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
            href="/admin/pip-stats"
            className="hb-page-action"
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
