# Homework Board

A daily homework posting site for admins and students. Built with Next.js, Supabase, and Google Gemini AI.

## Features

- **Student accounts** — sign up, view homework posts, comment, and receive notifications
- **Admin accounts** — post daily homework, send notifications to all students or individuals, delete posts
- **Comments** — all authenticated users can comment on any post
- **Checklist** — students tick off homework when done; progress is saved per student
- **Reminders** — admins send homework reminders to all students, individuals, or only those who haven't completed specific tasks. Optional email via Brevo (300/day on free tier) — admins see per-recipient delivery status
- **AI-powered post creation** — use Google Gemini AI to format and enhance homework posts

## Setup

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd homework-board
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the SQL migrations in the `supabase/` directory in the Supabase SQL Editor (`schema.sql` first, then any migrations in order — at minimum `migration-email-status.sql` and `migration-profile-email-prefs.sql` if you use Brevo)
3. Copy your project URL and anon key from Supabase Settings → API

### 4. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in the values:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
ADMIN_ACCESS_CODE=your-16-character-code
GOOGLE_GEMINI_API_KEY=your-gemini-api-key

# Optional — enable real email delivery for reminders via Brevo.
# See the "Reminders email (Brevo)" section below. Without these set,
# reminders still land in the in-app bell icon — email is the bonus channel.
BREVO_API_KEY=
BREVO_FROM_EMAIL=
BREVO_FROM_NAME=
# Required for the "View assignment" CTA links inside emails to resolve.
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 5. Create accounts

- **Students** — go to `/login`, switch to **Sign up**, choose **Student**, and register
- **Admins (you)** — go to `/login`, switch to **Sign up**, choose **Admin**, and enter your 16-character access code from `.env.local`

### 6. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

| Role    | Can do |
|---------|--------|
| Student | View posts, comment, mark homework done, read reminders (bell icon) |
| Admin   | Everything students can do, plus create/delete posts, send targeted reminders, and use AI to format posts |

### Admin Features

#### Creating Posts with AI
- When creating a new post, you can use the "Enhance with Gemini AI" button
- This will format and improve your homework description using Google's Gemini AI
- Requires a valid `GOOGLE_GEMINI_API_KEY` in your environment variables

#### Sending Targeted Reminders
- **All students** — send reminders to every student
- **Individual students** — select a specific student from the dropdown
- **Incomplete only** — send reminders only to students who haven't marked a specific task as complete
- Quick reminder templates for common scenarios (due tomorrow, due today, missing work)
- Link reminders to specific homework posts
- **Email delivery** — every reminder also fires a real email through [Brevo](https://brevo.com) when `BREVO_API_KEY` is set. See the "Reminders email (Brevo)" section below. The admin UI shows in-app + email counts per send

## Reminders email (Brevo)

When you send a reminder from `/admin`, it goes to the in-app bell icon of every recipient. If you also set up Brevo, you'll send a real email to each recipient at the same time. In-app delivery is the safety net — if Brevo is down or misconfigured, reminders still land.

**Free tier:** 300 emails/day and ~9,000/month. Fine for a single class. If you have >300 students or send reminders to everyone daily, upgrade to Brevo Lite ($9/mo for 20k/mo).

### Setup (one time)

1. **Create a Brevo account** at [brevo.com](https://www.brevo.com) (the former Sendinblue). The transactional email API is included on the free plan.
2. **Verify a "from" address.** Go to Brevo → **Settings → Senders & Domains → Senders**. Add the email address you want emails to come from. Pick one of:
   - A **school-owned domain** like `homework@yourschool.org` for best deliverability (you'll add an SPF + DKIM DNS record — Brevo gives you the exact TXT records to paste at your registrar).
   - The **default Brevo sender** (instant verification, but emails arrive in Gmail labeled "via brevo.com" — still read but slightly less trusted).
3. **Generate an API key.** Brevo → **SMTP & API → API Keys → Generate**. Copy the key.
4. **Add to Vercel.** In your Vercel project → **Settings → Environment Variables**, add (production scope):
   - `BREVO_API_KEY` — the key from step 3
   - `BREVO_FROM_EMAIL` — the verified sender email from step 2
   - `BREVO_FROM_NAME` — e.g. `Homework Board`
   - `NEXT_PUBLIC_SITE_URL` — your full production URL including protocol, e.g. `https://homework-board.vercel.app`. No trailing slash. Without this, the "View assignment" button in emails will link to localhost instead of your real site.
5. **Run the migration.** In Supabase SQL Editor, run `supabase/migration-email-status.sql`. It adds `email_sent_at`, `email_message_id`, and `email_error` columns to the `notifications` table. Without this, the action will fail when it tries to record email status.
6. **Deploy / restart.** Push to your main branch (or trigger a Vercel redeploy). Server actions need to pick up the new env vars.

### New-post emails

Every new homework post triggers a Brevo email to every opted-in user — same `BREVO_API_KEY`, different template (cyan header, "X just posted a new {subject} assignment" copy). Each recipient also gets an in-app bell notification regardless of their email preference.

Per-user email preferences live in the `profiles` table — see `supabase/migration-profile-email-prefs.sql`. Defaults are **on** for both:

- `email_post_notifications` — receives an email when a new post is published
- `email_reminder_notifications` — receives an email when an admin sends a reminder

Users toggle these at **Settings** (`/settings`). In-app bell notifications are unaffected by either flag — they always fire.

### How delivery is tracked

Every `notifications` row records its own email status — admins can see per-notification "Emailed" / "Email failed" badges on the `/notifications` page. The Brevo message ID is stored on the row, so when a parent says "I never got the reminder" you can grep the Brevo dashboard (Transactional → Logs) by message ID and see exactly what happened.

### Local development

If `BREVO_API_KEY` is unset, the action still inserts rows for in-app delivery and records `Brevo not configured on server` as the email_error — you'll see banners in the admin UI. To test locally with real sends, put the same env vars in `.env.local`.

## Deploy

In Supabase, add your production URL to **Authentication → URL Configuration → Site URL** and **Redirect URLs** (e.g. `https://your-app.vercel.app/auth/callback`).

## Troubleshooting

### "Email not confirmed" when signing in

Supabase blocks login until the user confirms their email. Fix it one of these ways:

**Option A — Disable confirmation (easiest for a class site)**  
Supabase → **Authentication → Providers → Email** → turn off **Confirm email** → Save.  
Then manually confirm any existing accounts: **Authentication → Users** → select the user → **Confirm email**.

**Option B — Confirm via email**  
Check the inbox (and spam) for a Supabase confirmation email and click the link, then sign in again.

**Option C — Confirm in Supabase dashboard**  
**Authentication → Users** → click the user → **Confirm user** / toggle email confirmed.

### Checklist not working

If students can't tick off homework, run `supabase/migration-post-completions.sql` in the Supabase SQL Editor (only needed if you set up the database before this feature was added).

### AI enhancement not working

- Ensure your `GOOGLE_GEMINI_API_KEY` is set in `.env.local`
- Verify the API key has the necessary permissions in Google Cloud Console
- Check that you have available quota in your Gemini API usage

## Tech stack

- [Next.js](https://nextjs.org) (App Router)
- [Supabase](https://supabase.com) (Auth, PostgreSQL, Row Level Security)
- [Google Gemini AI](https://ai.google.dev/gemini-api) (AI-powered content enhancement)
- [Tailwind CSS](https://tailwindcss.com)
- [TypeScript](https://www.typescriptlang.org)
