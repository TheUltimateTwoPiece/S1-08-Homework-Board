"use server";

import { redirect } from "next/navigation";
import { timingSafeEqual } from "crypto";
import { createClient } from "@/lib/supabase/server";

function formatAuthError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("email not confirmed")) {
    return "Your email is not confirmed yet. Check your inbox for the confirmation link from Supabase, or ask an admin to disable email confirmation in the project settings.";
  }

  if (lower.includes("invalid login credentials")) {
    return "Incorrect email or password. Please try again.";
  }

  return message;
}

function verifyAdminCode(input: string): boolean {
  const expected = process.env.ADMIN_SIGNUP_CODE;
  if (!expected || expected.length !== 16 || !/^[a-zA-Z0-9]{16}$/.test(expected)) {
    throw new Error("Admin signup is not configured on the server.");
  }

  const normalized = input.trim().toUpperCase();
  if (normalized.length !== 16 || !/^[A-Z0-9]{16}$/.test(normalized)) {
    return false;
  }

  const a = Buffer.from(normalized);
  const b = Buffer.from(expected.toUpperCase());
  return timingSafeEqual(a, b);
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("fullName") as string;
  const accountType = formData.get("accountType") as string;
  const adminCode = (formData.get("adminCode") as string) ?? "";

  if (accountType !== "student" && accountType !== "admin") {
    return { error: "Please select a valid account type." };
  }

  if (accountType === "admin") {
    if (!adminCode.trim()) {
      return { error: "Admin signup requires your 16-character access code." };
    }

    try {
      if (!verifyAdminCode(adminCode)) {
        return { error: "Invalid admin access code." };
      }
    } catch {
      return { error: "Admin signup is temporarily unavailable. Contact an admin." };
    }
  }

  const role = accountType === "admin" ? "admin" : "student";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) {
    return { error: formatAuthError(error.message) };
  }

  // Supabase requires email confirmation when enabled — no session until confirmed.
  if (data.user && !data.session) {
    return {
      success:
        "Account created! Check your email for a confirmation link, then sign in.",
    };
  }

  redirect("/");
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: formatAuthError(error.message) };
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
