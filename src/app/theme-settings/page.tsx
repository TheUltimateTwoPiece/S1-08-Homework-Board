import { requireProfile } from "@/lib/auth";
import { PageTopBar } from "@/components/PageTopBar";
import { ThemeSettingsForm } from "./ThemeSettingsForm";

export const dynamic = "force-dynamic";

export default async function ThemeSettingsPage() {
  const profile = await requireProfile();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <PageTopBar
        profile={profile}
        greetingName={profile.full_name}
        subtitle="Customize how your homework board looks — pick a preset or generate a palette from any image."
        showAdminCta={false}
      />

      <ThemeSettingsForm />
    </div>
  );
}
