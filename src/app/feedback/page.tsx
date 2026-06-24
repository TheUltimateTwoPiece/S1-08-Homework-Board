import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { FeedbackForm } from "@/components/FeedbackForm";

export default async function FeedbackPage() {
  await requireProfile();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/" className="hb-link mb-6 inline-block text-sm">
        ← Back to home
      </Link>
      <FeedbackForm />
    </div>
  );
}
