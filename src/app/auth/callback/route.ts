import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Only allow `next` to redirect to paths on THIS origin. Without this guard,
 * an attacker can craft a confirmation link like
 * `/auth/callback?code=...&next=//evil.com/phish` and the user would land
 * on evil.com after a real signup flow.
 *
 * We parse with `new URL(next, "http://placeholder.local")` so the parser
 * handles every encoding trick — `%2F`, `%5C`, backslashes, mixed
 * protocol-relative variants — and then verify the resolved origin is
 * still the placeholder (i.e. the input was a same-origin path, not an
 * absolute URL to a different host).
 */
function safeNext(next: string | null): string {
  if (!next) return "/";
  try {
    const url = new URL(next, "http://placeholder.local");
    if (url.origin !== "http://placeholder.local") return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
