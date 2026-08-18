import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UpdatePasswordForm } from "./UpdatePasswordForm";

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If the user isn't authenticated (no session from the recovery code exchange),
  // send them to login
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md hb-page-enter">
        <div className="hb-card-surface p-8">
          <div className="mb-6">
            <h1 className="hb-page-title text-2xl">Reset your password</h1>
            <p className="hb-body-text mt-1 text-sm">
              Enter a new password for your account.
            </p>
          </div>

          <UpdatePasswordForm />
        </div>
      </div>
    </div>
  );
}
