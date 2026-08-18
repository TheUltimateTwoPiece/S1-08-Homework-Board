import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { AnnouncementForm } from "@/components/AnnouncementForm";

export const revalidate = 0;

export default async function AdminAnnouncementsPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 border-b pb-4">
        <h1 className="hb-page-title text-2xl tracking-tight">
          Announcements
        </h1>
        <p className="hb-body-text mt-0.5 text-sm">
          Send a class-wide message to all students and admins. It appears in
          their notifications tab and emails anyone who has email reminders
          enabled.
        </p>
      </div>

      <AnnouncementForm />
    </div>
  );
}
