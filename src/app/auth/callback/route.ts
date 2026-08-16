import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

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

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");

  // ── TEMP DEBUG (remove after diagnosing password-reset → /login) ────────
  const debugCookieNames = request.cookies.getAll().map((c) => c.name);
  console.log("[auth/callback TEMP DEBUG] request", {
    origin,
    pathname: new URL(request.url).pathname,
    hasCode: Boolean(code),
    codePrefix: code ? `${code.slice(0, 6)}…` : null,
    type,
    rawNext: searchParams.get("next"),
    hasCodeVerifierCookie: debugCookieNames.some((n) =>
      n.endsWith("-code-verifier"),
    ),
    cookieNames: debugCookieNames,
  });
  // ─────────────────────────────────────────────────────────────────────────

  // Default to /update-password for recovery flows if no explicit next is given
  const defaultNext = type === "recovery" ? "/update-password" : "/";
  const next = safeNext(searchParams.get("next") ?? defaultNext);

  if (code) {
    // Create the redirect response FIRST so we can set cookies on it directly.
    // This is the same pattern used by the middleware — cookies MUST be set on
    // the actual response object that gets returned, otherwise the session
    // won't survive the redirect.
    const response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            for (const { name, value, options } of cookiesToSet) {
              response.cookies.set(name, value, options);
            }
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      console.log("[auth/callback TEMP DEBUG] exchange OK →", next);
      return response;
    }

    console.error("[auth/callback TEMP DEBUG] exchange FAILED", {
      name: error.name,
      message: error.message,
      status: error.status,
      stringified: String(error),
    });
  } else {
    console.log("[auth/callback TEMP DEBUG] no `code` param → skipping exchange");
  }

  console.log("[auth/callback TEMP DEBUG] redirecting to /login");
  return NextResponse.redirect(`${origin}/login`);
}
