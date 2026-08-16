import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { FeedbackForm } from "@/components/FeedbackForm";

export default async function FeedbackPage() {
  await requireProfile();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link href="/" className="hb-link inline-block text-sm">
          ← Back to home
        </Link>
      </div>
      <FeedbackForm />
    </div>
  );
}
