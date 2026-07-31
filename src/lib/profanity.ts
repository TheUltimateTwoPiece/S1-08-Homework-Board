// Server-side profanity filter for free-form user text.
//
// Used by:
//   - createPost / updatePost  -> title + content
//   - addComment               -> content
//   - submitFeedback           -> message
//   - updateProfile            -> full_name (so the display-name field
//                                 isn't an obvious bypass once posts
//                                 and comments are gated)
//   - sendReminder             -> title + message (admin reminder body is
//                                 still user-typed freeform text, so we
//                                 apply the same gate for consistency)
//
// Configure the destination via the PROFANITY_REDIRECT_URL env var
// (server-only; no NEXT_PUBLIC_ prefix needed because the redirect is
// initiated in a server action and never read by the browser bundle).
//
//   PROFANITY_REDIRECT_URL=https://www.youtube.com/watch?v=3Gwj-QOCxKo
//
// Any URL that starts with `http://` or `https://` is accepted; everything
// else is rejected so the redirect can't be turned into an XSS / open-
// redirect target. If the variable is unset, the filter is a no-op (with
// a one-time warning so it's obvious during development that you forgot
// to configure it). This is safer than guessing a URL.
//
// The redirect URL is also validated to start with `http://` or
// `https://` — anything else (most importantly `javascript:`) is
// rejected because `redirect()` would otherwise follow it verbatim and
// become an open-redirect / XSS vector.
//
// The default word list below is intentionally modest — a school-friendly
// starter set. To extend it without editing the source, pass a
// comma-separated PROFANITY_EXTRA_WORDS env var, e.g.
//
//   PROFANITY_EXTRA_WORDS="heck,jeez,gosh"
//
// Custom words are appended to the built-in list and matched with the
// same word-boundary rules. The built-in list is canonical so a deployed
// environment can never regress to a "missing" default.
//
// IMPORTANT: env-var-driven words are baked in on first match and stay
// for the lifetime of the server process. Restart the process to pick up
// changes — don't try to mutate the env at runtime.

const BUILTIN_PROFANITY_WORDS: readonly string[] = [
  // Mild / common
  "damn",
  "dammit",
  "hell",
  "crap",
  // Stronger common terms
  "shit",
  "sh*t",
  "shitty",
  "fuck",
  "f*ck",
  "fucking",
  "f**k",
  "bitch",
  "b*tch",
  "bastard",
  "b*stard",
  "asshole",
  "assh*le",
  "ass",
  "piss",
  "dick",
  "d*ck",
  "bullshit",
  "bullsh*t",
  // Common abbreviations
  "wtf",
  "stfu",
  "lmfao",
  // Slurs are intentionally NOT in this list — production moderation
  // requires a denylist tuned by your community team, not a public
  // default. If you find yourself adding one here, write a comment
  // explaining why so the next editor doesn't quietly normalize it.
];

function uniqLower(items: readonly string[]): string[] {
  return Array.from(new Set(items.map((w) => w.toLowerCase().trim()).filter(Boolean)));
}

function resolveExtraWordsFromEnv(): string[] {
  const raw = process.env.PROFANITY_EXTRA_WORDS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((w) => w.toLowerCase().trim())
    .filter(Boolean);
}

let cachedWords: readonly string[] | null = null;
function profanityWords(): readonly string[] {
  if (cachedWords) return cachedWords;
  cachedWords = uniqLower([...BUILTIN_PROFANITY_WORDS, ...resolveExtraWordsFromEnv()]);
  return cachedWords;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Normalize `text` so trivial ASCII / Unicode bypasses don't slip through:
 *
 *   - NFKD (compatibility decomposition) splits precomposed Latin
 *     letters into ASCII letter + combining mark, so `dámn` becomes
 *     `d` + combining acute + `mn`. After the combining-mark strip
 *     below, it reduces to `damn`.
 *   - Strip zero-width / bidi / directional formatting characters that
 *     students use to split a word in two (`d​amn`, `d‍amn`).
 *   - Strip combining diacritical marks from all five Latin / Greek
 *     blocks that decorate letters.
 *   - Collapse runs of non-letter / non-digit / non-asterisk characters
 *     to a single space. Asterisk is preserved on purpose — it's the
 *     conventional "letter stand-in" in obfuscated referents like
 *     `sh*t` and `f*ck`, and we want the literal `sh*t` / `f*ck`
 *     denylist entries to match those inputs.
 *
 * NOTE: Apostrophes (') are intentionally NOT preserved by the collapse
 * step — splitting a word with an apostrophe is a documented bypass
 * surface (`fu'ck`, `sh'it`). Names like "don't" become `don t` after
 * collapse, which is cosmetically wrong but does NOT trip the filter
 * (none of the denylist words match `don` alone).
 *
 * Cyrillic / other-script homoglyph substitution is not fully defeated
 * by NFKD alone. For a school app this is acceptable — the bypass
 * surface is narrow and the false-positive cost of being stricter
 * would be high.
 *
 * KNOWN LIMITATION: "letter-drop" obfuscation (e.g. `F**K`, `sh.t` —
 * some letters omitted entirely) cannot be caught without phonetic /
 * edit-distance matching, which is out of scope for this filter. The
 * smoke script documents this expectation explicitly.
 */
function normalize(text: string): string {
  return (
    text
      .normalize("NFKD")
      // Zero-width + bidi / directional marks (U+200B–U+200F,
      // U+202A–U+202E, U+2066–U+2069, U+FEFF).
      .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
      // Combining diacritical marks across all four Unicode blocks.
      .replace(
        /[\u0300-\u036f\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]/g,
        "",
      )
      // Collapse non-letter / non-digit / non-asterisk runs to a
      // single space. No apostrophes are preserved — see the doc
      // comment above. Asterisks are preserved as "letter stand-in".
      .replace(/[^a-zA-Z0-9*]+/g, " ")
  );
}

/**
 * Returns true if `text` contains any profane word. Matches in two
 * complementary passes:
 *
 *   1. Literal `\bWORD\b` after the normalize pass above. Catches
 *      `shit`, `bullshit`, `asshole`, and the literal `sh*t` / `f*ck`
 *      entries that exist in the denylist specifically to defeat the
 *      asterisk-obfuscation bypass.
 *
 *   2. Per-letter `[\s*]*`-separated flex pattern. Defeats letter-
 *      spacing obfuscation: `f u c k`, `f  u  c  k`, `f u ck`, `sh i t`,
 *      and so on. Each letter of the denylist is independently regex-
 *      escaped so an extension word like `f.ck` still matches the
 *      literal '.' rather than the regex '.'. The pattern accepts
 *      arbitrary whitespace OR asterisk runs between letters; only
 *      those two character classes, so innocent prose with hyphens
 *      / periods cannot accidentally bridge unrelated words into a
 *      denylist match.
 *
 * The order matters: the literal pass is cheaper and runs first so
 * common cases short-circuit before the flex regex compiles.
 */
export function containsProfanity(text: string | null | undefined): boolean {
  if (!text) return false;
  const words = profanityWords();
  if (words.length === 0) return false;
  const haystack = normalize(text).toLowerCase();
  if (!haystack) return false;

  for (const word of words) {
    const escaped = escapeRegex(word);
    // Pass 1: literal whole-word match.
    if (new RegExp(`\\b${escaped}\\b`, "i").test(haystack)) return true;
    // Pass 2: per-letter, [\\s*]*-separated flex match.
    const flexPattern = word
      .split("")
      .map((c) => escapeRegex(c))
      .join("[\\s*]*");
    if (new RegExp(`\\b${flexPattern}\\b`, "i").test(haystack)) return true;
  }
  return false;
}

let warnedAboutMissingRedirect = false;
let warnedAboutBadRedirectUrl = false;

/**
 * Returns the configured profanity-redirect URL, or `null` if the filter
 * is not configured or the configured URL is unsafe. `null` lets callers
 * decide what to do (most call sites just no-op, which is safer than
 * throwing the user at a `javascript:` payload).
 *
 * Sanitization: only `http://` or `https://` URLs are accepted. This
 * blocks open-redirect exploits via `javascript:`, `data:`, etc.
 */
export function getProfanityRedirectUrl(): string | null {
  const url = process.env.PROFANITY_REDIRECT_URL?.trim();
  if (!url) {
    if (!warnedAboutMissingRedirect) {
      warnedAboutMissingRedirect = true;
      console.warn(
        "[profanity] PROFANITY_REDIRECT_URL is not set \u2014 profanity filter is a no-op. " +
          "Set it in .env.local to enable the redirect.",
      );
    }
    return null;
  }
  if (!/^https?:\/\//i.test(url)) {
    if (!warnedAboutBadRedirectUrl) {
      warnedAboutBadRedirectUrl = true;
      console.warn(
        `[profanity] PROFANITY_REDIRECT_URL must start with http:// or https://. Got "${url.slice(0, 32)}". Filter disabled until fixed.`,
      );
    }
    return null;
  }
  return url;
}

/**
 * Convenience: when profanity is found AND a redirect URL is configured,
 * returns `{ triggered: true, redirectUrl }` so server actions can write
 * a one-liner before persisting:
 *
 *   const p = tripProfanity({ userId: user.id }, content);
 *   if (p.triggered) redirect(p.redirectUrl);
 *
 * `userId` is logged server-side purely so admins can trace who is
 * hitting the filter. PII is omitted from production logs by default
 * to avoid emitting stable student identifiers to stdout / log
 * aggregators. Set NODE_ENV !== 'production' (the default in dev) to
 * see the full line.
 */
export function tripProfanity(
  context: { userId?: string | null },
  ...texts: Array<string | null | undefined>
): { triggered: true; redirectUrl: string } | { triggered: false } {
  if (!texts.some((t) => containsProfanity(t))) return { triggered: false };
  const redirectUrl = getProfanityRedirectUrl();
  if (!redirectUrl) return { triggered: false };
  if (process.env.NODE_ENV === "production") {
    console.info(`[profanity] blocked (PII omitted in production) redirect=${redirectUrl}`);
  } else {
    console.info(
      `[profanity] blocked user=${context.userId ?? "anonymous"} redirect=${redirectUrl}`,
    );
  }
  return { triggered: true, redirectUrl };
}
