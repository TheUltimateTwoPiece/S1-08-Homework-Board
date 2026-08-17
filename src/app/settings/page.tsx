import { requireProfile } from "@/lib/auth";
import { PageTopBar } from "@/components/PageTopBar";
import { SettingsForm } from "./SettingsForm";
import { ThemeSettingsForm } from "@/components/ThemeSettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const profile = await requireProfile();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <PageTopBar
        profile={profile}
        greetingName={profile.full_name}
        subtitle="Profile, email preferences, and appearance."
        showAdminCta={false}
      />

      <div className="space-y-8">
        <SettingsForm profile={profile} />

        <section aria-labelledby="appearance-heading">
          <div className="mb-4 border-b pb-2">
            <h2
              id="appearance-heading"
              className="hb-page-title text-lg leading-snug"
            >
              Appearance
            </h2>
            <p className="hb-muted-text mt-0.5 text-sm">
              Pick a preset theme, or upload an image and we'll recommend a
              colour scheme you can tweak with the eyedropper.
            </p>
          </div>
          <ThemeSettingsForm />
        </section>
      </div>
    </div>
  );
}
