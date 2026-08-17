import { getPromptDateString } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { PageTopBar } from "@/components/PageTopBar";
import { PipWidget } from "@/components/PipWidget";
import { getChats } from "@/actions/pip-chats";
import { DAILY_LIMIT } from "@/lib/pip-types";

export const revalidate = 0;

export default async function PipPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const todayStr = getPromptDateString();

  const [{ data: usage }, chats] = await Promise.all([
    supabase
      .from("pip_prompts")
      .select("count")
      .eq("user_id", profile.id)
      .eq("prompt_date", todayStr)
      .maybeSingle(),
    getChats(),
  ]);

  const used = (usage as { count?: number } | null)?.count ?? 0;
  const remaining = Math.max(0, DAILY_LIMIT - used);

  const firstName = profile.full_name.split(" ")[0] ?? profile.full_name;

  return (
    <div className="hb-pip-page mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <PageTopBar
        profile={profile}
        greetingName={firstName}
        subtitle={`Chat with Pip — ${remaining} prompt${remaining !== 1 ? "s" : ""} left today`}
        showAdminCta={false}
      />

      <PipWidget remaining={remaining} initialChats={chats} />
    </div>
  );
}
