"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tripProfanity } from "@/lib/profanity";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const BUG_BUCKET = "attachments";

type BugReportResult = { error?: string; success?: boolean };

function textValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "screenshot";
}

export async function submitBugReport(formData: FormData): Promise<BugReportResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const title = textValue(formData, "title");
  const description = textValue(formData, "description");
  const steps = textValue(formData, "stepsToReproduce");
  const categoryValue = textValue(formData, "category");
  const category = ["website", "posts", "pip", "account", "other"].includes(categoryValue)
    ? categoryValue
    : "website";
  const screenshots = formData.getAll("screenshots").filter(
    (value): value is File => value instanceof File && value.size > 0,
  );

  if (!title || !description) {
    return { error: "Add a short title and describe what went wrong." };
  }
  if (screenshots.length === 0) {
    return { error: "Please attach at least one screenshot so the issue can be diagnosed." };
  }

  const profanity = tripProfanity({ userId: user.id }, title, description, steps);
  if (profanity.triggered) redirect(profanity.redirectUrl);

  for (const file of screenshots) {
    if (!file.type.startsWith("image/")) {
      return { error: `"${file.name}" is not an image. Please upload screenshots only.` };
    }
    if (file.size > MAX_FILE_BYTES) {
      return { error: `"${file.name}" is larger than 10 MB.` };
    }
  }

  const paths = screenshots.map(
    (file) => `bug-reports/${user.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`,
  );
  const uploads = await Promise.all(
    screenshots.map((file, index) =>
      supabase.storage.from(BUG_BUCKET).upload(paths[index], file, {
        contentType: file.type,
        upsert: false,
      }).then(({ error }) => ({ error, path: paths[index] })),
    ),
  );
  const failedUpload = uploads.find((upload) => upload.error);
  if (failedUpload) {
    const successfulPaths = uploads.filter((upload) => !upload.error).map((upload) => upload.path);
    if (successfulPaths.length > 0) {
      await supabase.storage.from(BUG_BUCKET).remove(successfulPaths);
    }
    return { error: failedUpload.error?.message ?? "Screenshot upload failed." };
  }

  const { error } = await supabase.from("bug_reports").insert({
    reporter_id: user.id,
    title,
    description,
    steps_to_reproduce: steps,
    category,
    screenshot_paths: paths,
  });

  if (error) {
    await supabase.storage.from(BUG_BUCKET).remove(paths);
    return { error: error.message };
  }

  revalidatePath("/bug-report");
  revalidatePath("/admin/bug-reports");
  revalidatePath("/admin");
  return { success: true };
}
