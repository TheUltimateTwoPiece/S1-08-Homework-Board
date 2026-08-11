import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { formatAppDateTime } from "@/lib/time";

type BugReport = {
  id: string;
  reporter_id: string;
  title: string;
  description: string;
  steps_to_reproduce: string;
  category: string;
  screenshot_paths: string[];
  created_at: string;
  profiles?: { full_name?: string; email?: string; avatar_url?: string | null } | null;
};

export const dynamic = "force-dynamic";

export default async function AdminBugReportsPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bug_reports")
    .select("*, profiles(full_name, email, avatar_url)")
    .order("created_at", { ascending: false })
    .limit(200);

  const reports = (data as BugReport[] | null) ?? [];
  const withScreenshots = await Promise.all(reports.map(async (report) => {
    const signed = await Promise.all(report.screenshot_paths.map(async (path) => {
      const result = await supabase.storage.from("attachments").createSignedUrl(path, 60 * 60);
      return result.data?.signedUrl ?? null;
    }));
    return { ...report, screenshotUrls: signed.filter((url): url is string => Boolean(url)) };
  }));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="hb-page-title text-2xl tracking-tight">Bug reports</h1>
          <p className="hb-body-text mt-1 text-sm">Review issues submitted by students and admins.</p>
        </div>
        <span className="hb-card-meta rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold dark:bg-slate-800">{withScreenshots.length} total</span>
      </div>

      {error ? (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">Could not load bug reports: {error.message}</div>
      ) : withScreenshots.length === 0 ? (
        <div className="hb-empty-state rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center dark:border-slate-700"><p className="hb-section-title text-sm">No bug reports yet.</p></div>
      ) : (
        <div className="space-y-5">
          {withScreenshots.map((report) => (
            <article key={report.id} className="hb-card-surface rounded-2xl border p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar id={report.reporter_id} name={report.profiles?.full_name ?? "User"} src={report.profiles?.avatar_url ?? null} size="sm" />
                  <div className="min-w-0">
                    <h2 className="hb-card-section truncate text-base">{report.title}</h2>
                    <p className="hb-card-meta text-xs">{report.profiles?.full_name ?? "User"}{report.profiles?.email ? ` · ${report.profiles.email}` : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-800 dark:bg-rose-900/40 dark:text-rose-200">{report.category}</span>
                  <time className="hb-card-meta text-xs" dateTime={report.created_at}>{formatAppDateTime(report.created_at)}</time>
                </div>
              </div>
              <p className="hb-card-body mt-4 whitespace-pre-line text-sm leading-relaxed">{report.description}</p>
              {report.steps_to_reproduce && <div className="mt-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800"><h3 className="hb-card-section text-xs font-bold uppercase tracking-wide">Steps to reproduce</h3><p className="hb-card-body mt-2 whitespace-pre-line text-sm">{report.steps_to_reproduce}</p></div>}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {report.screenshotUrls.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border bg-slate-50 dark:bg-slate-800"><img src={url} alt={`${report.title} screenshot ${index + 1}`} className="aspect-video w-full object-cover transition group-hover:scale-105" /></a>)}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
