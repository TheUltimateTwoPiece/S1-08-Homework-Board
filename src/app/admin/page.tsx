import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { CreatePostForm } from "@/components/CreatePostForm";
import { SendReminderForm } from "@/components/SendReminderForm";
import type { Post, Profile } from "@/lib/types";
import { unstable_cache } from "next/cache";

export const revalidate = 60;

export default async function AdminPage() {
  const profile = await requireProfile();

  if (profile.role !== "admin") {
    redirect("/");
  }

  const supabase = await createClient();

  const getCachedStudents = unstable_cache(
    async () => {
      return await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("role", "student")
        .order("full_name");
    },
    ["students"],
    { revalidate: 300, tags: ["students"] }
  );

  const getCachedPosts = unstable_cache(
    async () => {
      return await supabase
        .from("posts")
        .select("id, title")
        .order("created_at", { ascending: false })
        .limit(20);
    },
    ["posts"],
    { revalidate: 30, tags: ["posts"] }
  );

  const [{ data: students }, { data: posts }] = await Promise.all([
    getCachedStudents(),
    getCachedPosts(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Admin panel</h1>
        <p className="mt-1 text-sm text-slate-600">
          Post daily homework and send reminders so students complete their work.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <CreatePostForm />
        <SendReminderForm
          students={(students as Profile[]) ?? []}
          posts={(posts as Pick<Post, "id" | "title">[]) ?? []}
        />
      </div>
    </div>
  );
}
