/**
 * In-process Pip cost controls shared by the streaming route and the
 * non-streaming server action. These are defence-in-depth on top of the
 * authoritative daily limit enforced atomically in Supabase
 * (`pip_try_increment`) and Gemini's own per-minute/per-day quotas.
 *
 * Scope: module-level state lives in the warm serverless instance. It resets
 * on cold starts and is not shared across concurrent instances, so it can
 * never guarantee a hard limit — but it catches the common failure modes:
 *   - accidental double-submits (one in-flight request per user),
 *   - identical questions re-sent back-to-back (small TTL cache),
 *   - hammering Gemini while a quota error is already being returned.
 */

const IN_FLIGHT_TTL_MS = 90_000; // auto-release stale locks if a throw is missed
const COOLDOWN_MS = 60_000; // global backoff after Gemini returns 429
const CACHE_TTL_MS = 5 * 60_000; // identical-question reuse window
const CACHE_MAX_ENTRIES = 200;

type CacheEntry = { reply: string; expiresAt: number };

// Per-user in-flight guard. A user may only have one Gemini call at a time.
const inFlight = new Map<string, number>();

// Shared, bounded, timestamp-based cache. No timers so it never keeps a
// serverless instance alive; stale entries are evicted lazily on access.
const replyCache = new Map<string, CacheEntry>();

// Global quota-exhausted backoff (unix ms). Any 429 from Gemini sets it.
let cooldownUntil = 0;

export function isCoolingDown(): boolean {
  return Date.now() < cooldownUntil;
}

export function cooldownRemainingSeconds(): number {
  const remaining = Math.ceil((cooldownUntil - Date.now()) / 1000);
  return Math.max(0, remaining);
}

export function markQuotaExhausted(): void {
  cooldownUntil = Date.now() + COOLDOWN_MS;
}

export function acquireInFlight(userId: string): boolean {
  const now = Date.now();
  const existing = inFlight.get(userId);
  if (existing && existing > now) return false;
  inFlight.set(userId, now + IN_FLIGHT_TTL_MS);
  return true;
}

export function releaseInFlight(userId: string): void {
  inFlight.delete(userId);
}

function cacheKey(userId: string, question: string): string {
  return `${userId}\u0000${question.toLocaleLowerCase().replace(/\s+/g, " ").trim()}`;
}

export function getCachedReply(userId: string, question: string): string | null {
  const key = cacheKey(userId, question);
  const entry = replyCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    replyCache.delete(key);
    return null;
  }
  return entry.reply;
}

export function putCachedReply(userId: string, question: string, reply: string): void {
  if (replyCache.size >= CACHE_MAX_ENTRIES) {
    // Evict the oldest entry (Map iteration is insertion-ordered).
    const oldest = replyCache.keys().next();
    if (!oldest.done) replyCache.delete(oldest.value);
  }
  replyCache.set(cacheKey(userId, question), {
    reply,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}
