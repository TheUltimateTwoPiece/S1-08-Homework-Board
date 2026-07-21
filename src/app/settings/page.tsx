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
        greetingName="Settings"
        subtitle="Update how you appear across the homework board."
        showAdminCta={false}
      />

      <SettingsForm profile={profile} />
    </div>
  );
}