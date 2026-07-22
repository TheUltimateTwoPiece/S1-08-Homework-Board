/**
 * Brevo (formerly Sendinblue) transactional email wrapper.
 *
 * Calls the Brevo REST API directly with fetch instead of using the SDK — the
 * SDK is a thin wrapper over the same endpoint and adds cold-start weight for
 * no real benefit. See: https://developers.brevo.com/reference/sendtransacemail
 *
 * Required env vars for actual sending:
 *   - BREVO_API_KEY         Brevo dashboard then SMTP and API then API Keys
 *   - BREVO_FROM_EMAIL      verified sender in Brevo (Settings then Senders and Domains)
 *   - BREVO_FROM_NAME       display name shown in the inbox (e.g. "Homework Board")
 *
 * Optional:
 *   - BREVO_TEST_TO_EMAIL   when set, every send is redirected to this address
 *                              with TEST prefix in the subject. Use on staging to
 *                              verify the pipeline without spamming parents.
 *   - NEXT_PUBLIC_SITE_URL  used to build the "View assignment" link in emails.
 */

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export type SendEmailResult =
  | { ok: true; messageId: string; testMode: boolean }
  | { ok: false; error: string; testMode: boolean };

/**
 * Runs `worker` over `items` with at most `concurrency` in flight at once.
 * Sequential chunks of `concurrency` items per await — simple, readable, and
 * stays below Brevo's ~5/sec sustained rate limit.
 */
export async function processInBatches<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((item) => worker(item)));
    results.push(...batchResults);
  }
  return results;
}

/**
 * Returns true iff the env vars needed to actually call Brevo are present.
 * Callers short-circuit cleanly to in-app-only delivery when this is false.
 */
export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.BREVO_API_KEY &&
      process.env.BREVO_FROM_EMAIL &&
      process.env.BREVO_FROM_NAME,
  );
}

/**
 * Sends a single transactional email. If BREVO_TEST_TO_EMAIL is set, the
 * email is redirected to that address with [TEST] prepended to the subject
 * and the real recipient's identity is dropped from the visible To-line. No
 * BCC: the actual recipient sees no test artifact.
 */
export async function sendReminderEmail(params: {
  to: string;
  toName: string;
  subject: string;
  htmlContent: string;
  tag?: string;
}): Promise<SendEmailResult> {
  const fromEmail = process.env.BREVO_FROM_EMAIL;
  const fromName = process.env.BREVO_FROM_NAME;
  const apiKey = process.env.BREVO_API_KEY;

  const testToEmail = process.env.BREVO_TEST_TO_EMAIL;
  const testMode = Boolean(testToEmail);

  if (!apiKey || !fromEmail || !fromName) {
    return {
      ok: false,
      error: "Brevo not configured (missing BREVO_API_KEY / from address)",
      testMode,
    };
  }

  const toEmail = testToEmail ?? params.to;
  const toLabel = testToEmail
    ? `via test mode (originally for ${params.to})`
    : params.toName;
  const subject = testMode ? `[TEST] ${params.subject}` : params.subject;

  try {
    const res = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: toEmail, name: toLabel }],
        subject,
        htmlContent: params.htmlContent,
        ...(params.tag ? { tags: [params.tag] } : {}),
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      // Brevo returns a JSON body with a `message` field on error. Surface it
      // to admins so they can debug from the per-row badge tooltip.
      let detail = `Brevo error ${res.status}`;
      try {
        const errBody = (await res.json()) as { message?: string; code?: string };
        if (errBody.message) detail += `: ${errBody.message}`;
        if (errBody.code) detail += ` (${errBody.code})`;
      } catch {
        // body wasn't JSON — leave the status-only detail
      }
      return { ok: false, error: detail, testMode };
    }

    const body = (await res.json()) as { messageId?: string };
    return {
      ok: true,
      messageId: body.messageId ?? "unknown",
      testMode,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error contacting Brevo";
    return { ok: false, error: msg, testMode };
  }
}

// --- HTML template + escape helpers ---

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Same set of escapes as escapeHtml — safe to interpolate inside HTML
 * attribute values. The `"` escape keeps the attribute boundary intact.
 */
export function escapeAttr(s: string): string {
  return escapeHtml(s);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Only allow the CTA link slug if the postId is a real UUID. The form already
 * populates it from a server-side select of UUIDs, but a defensive check
 * blocks attribute injection if a malformed value ever lands in the template.
 */
function safePostSlug(postId: string | null | undefined): string | null {
  return postId && UUID_RE.test(postId) ? postId : null;
}

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
}

/**
 * Builds the inline-styled HTML body for a reminder email.
 * Inline styles only (no <style> blocks / external CSS) so Gmail, Outlook, and
 * iOS Mail all render these reliably. Centre-column layout, max-width 600px.
 */
export function renderReminderEmail(params: {
  recipientName: string;
  title: string;
  message: string;
  senderName: string;
  postId?: string | null;
  postTitle?: string | null;
}): string {
  const safeName = escapeHtml(params.recipientName);
  const safeTitle = escapeHtml(params.title);
  const safeMessage = escapeHtml(params.message).replace(/\n/g, "<br>");
  const safeSender = escapeHtml(params.senderName);
  const safePostTitle = params.postTitle
    ? escapeHtml(params.postTitle)
    : null;

  const linkPostId = safePostSlug(params.postId);
  const cta = linkPostId
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;">
        <tr>
          <td style="background-color:#4f46e5; border-radius:8px;">
            <a href="${escapeAttr(`${siteUrl()}/posts/${linkPostId}`)}"
               style="display:inline-block; padding:12px 22px; color:#ffffff; text-decoration:none; font-size:14px; font-weight:600; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              View assignment →
            </a>
          </td>
        </tr>
      </table>`
    : "";

  const postRef = safePostTitle
    ? `<p style="margin:0 0 8px; padding:0; font-size:12px; color:#6366f1; font-weight:600;">Re: ${safePostTitle}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle}</title>
</head>
<body style="margin:0; padding:0; background-color:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#0f172a;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f8fafc; padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px; width:100%; background-color:#ffffff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
          <tr>
            <td style="background-color:#4f46e5; padding:24px 32px;">
              <p style="margin:0; color:#c7d2fe; font-size:12px; font-weight:600; letter-spacing:0.05em; text-transform:uppercase;">Homework Reminder</p>
              <h1 style="margin:6px 0 0; color:#ffffff; font-size:20px; font-weight:600; line-height:1.3;">${safeTitle}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 16px; color:#475569; font-size:14px;">Hi ${safeName},</p>
              ${postRef}
              <div style="margin:0; color:#0f172a; font-size:15px; line-height:1.6;">${safeMessage}</div>
              ${cta}
            </td>
          </tr>
          <tr>
            <td style="background-color:#f1f5f9; padding:16px 32px; border-top:1px solid #e2e8f0;">
              <p style="margin:0; font-size:12px; color:#64748b; line-height:1.5;">
                Sent by ${safeSender} via Homework Board. This is an automated class reminder.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
