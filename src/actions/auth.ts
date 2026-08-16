"use server";

import { redirect } from "next/navigation";
import { timingSafeEqual } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tripProfanity } from "@/lib/profanity";

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
  // Keep the documented legacy name working while standardising on
  // ADMIN_SIGNUP_CODE for new deployments.
  const expected = process.env.ADMIN_SIGNUP_CODE ?? process.env.ADMIN_ACCESS_CODE;
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

  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");
  const fullNameValue = formData.get("fullName");
  const accountTypeValue = formData.get("accountType");
  const adminCodeValue = formData.get("adminCode");
  const email = typeof emailValue === "string" ? emailValue.trim() : "";
  const password = typeof passwordValue === "string" ? passwordValue : "";
  const fullName = typeof fullNameValue === "string" ? fullNameValue.trim() : "";
  const accountType = typeof accountTypeValue === "string" ? accountTypeValue : "";
  const adminCode = typeof adminCodeValue === "string" ? adminCodeValue : "";

  if (!email || !password || !fullName) {
    return { error: "Name, email, and password are required." };
  }

  if (fullName.length > 80) {
    return { error: "Full name is too long (max 80 characters)." };
  }

  const profanity = tripProfanity({ userId: null }, fullName);
  if (profanity.triggered) redirect(profanity.redirectUrl);

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

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return {
        error: "Admin signup is not configured on the server. Contact an admin.",
      };
    }
  }

  // Never send a role in public Auth metadata. The database trigger treats
  // all new Auth users as students because metadata can be forged by anyone
  // using the public Supabase anon key. Verified admin signups are promoted
  // below through the server-only service-role client.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) {
    return { error: formatAuthError(error.message) };
  }

  if (accountType === "admin" && data.user) {
    // Supabase may return a user with no identities for an already-registered
    // email. Never promote an existing account through the signup form.
    if (!data.user.identities || data.user.identities.length === 0) {
      return { error: "An account with this email already exists. Sign in instead." };
    }

    try {
      const adminSupabase = createAdminClient();
      const { error: profileError } = await adminSupabase
        .from("profiles")
        .upsert(
          {
            id: data.user.id,
            email: data.user.email ?? email,
            full_name: fullName,
            role: "admin",
          },
          { onConflict: "id" },
        );

      if (profileError) {
        await adminSupabase.auth.admin.deleteUser(data.user.id);
        console.error("[signUp] admin profile provisioning failed", profileError);
        return { error: "Admin account setup failed. Please contact an admin." };
      }
    } catch (provisioningError) {
      console.error("[signUp] admin provisioning failed", provisioningError);
      return { error: "Admin account setup failed. Please contact an admin." };
    }
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

  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");
  const email = typeof emailValue === "string" ? emailValue.trim() : "";
  const password = typeof passwordValue === "string" ? passwordValue : "";

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: formatAuthError(error.message) };
  }

  redirect("/");
}

export async function resetPassword(formData: FormData): Promise<{ error?: string; success?: string } | undefined> {
  const supabase = await createClient();

  const emailValue = formData.get("email");
  const email = typeof emailValue === "string" ? emailValue.trim() : "";
  if (!email) {
    return { error: "Please enter your email address." };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback?next=/update-password`,
  });

  if (error) {
    return { error: formatAuthError(error.message) };
  }

  return {
    success:
      "If that email is registered, you'll receive a password reset link shortly. Check your spam folder if you don't see it.",
  };
}

export async function updatePassword(formData: FormData): Promise<{ error?: string; success?: string } | undefined> {
  const supabase = await createClient();

  const passwordValue = formData.get("password");
  const confirmPasswordValue = formData.get("confirmPassword");
  const password = typeof passwordValue === "string" ? passwordValue : "";
  const confirmPassword = typeof confirmPasswordValue === "string" ? confirmPasswordValue : "";

  if (!password || password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const { error } = await supabase.auth.updateUser({ password });

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
