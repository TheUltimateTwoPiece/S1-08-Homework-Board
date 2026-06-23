# Homework Board

A daily homework posting site for admins and students. Built with Next.js and Supabase.

## Features

- **Student accounts** — sign up, view homework posts, comment, and receive notifications
- **Admin accounts** — post daily homework, send notifications to all students or individuals, delete posts
- **Comments** — all authenticated users can comment on any post
- **Checklist** — students tick off homework when done; progress is saved per student
- **Reminders** — admins send homework reminders to all students or individuals; everyone sees a bell icon with unread count

## Setup

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free project
2. In the SQL Editor, run the contents of `supabase/schema.sql`
3. Under **Project Settings → API**, copy your project URL and anon key
4. **Disable email confirmation** (recommended for a class site):
   - Go to **Authentication → Providers → Email**
   - Turn **off** “Confirm email”
   - Save

   Without this, students must click a confirmation link in their email before they can sign in.

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in your Supabase URL and anon key in `.env.local`.

Set `ADMIN_SIGNUP_CODE` to a 16-character alphanumeric code (letters and numbers only). This is the secret code you give to anyone who should be able to sign up as an admin. The default in `.env.local.example` is `534AD5X2H4FB76YF` — change it before deploying.

### 3. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Create accounts

- **Students** — go to `/login`, switch to **Sign up**, choose **Student**, and register
- **Admins (you)** — go to `/login`, switch to **Sign up**, choose **Admin**, and enter your 16-character access code from `.env.local`

## Usage

| Role    | Can do |
|---------|--------|
| Student | View posts, comment, mark homework done, read reminders (bell icon) |
| Admin   | Everything students can do, plus create/delete posts and send homework reminders |

## Deploy

Deploy to [Vercel](https://vercel.com) and add the same environment variables from `.env.local`.

In Supabase, add your production URL to **Authentication → URL Configuration → Site URL** and **Redirect URLs** (e.g. `https://your-app.vercel.app/auth/callback`).

## Troubleshooting

### “Email not confirmed” when signing in

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

## Tech stack

- [Next.js](https://nextjs.org) (App Router)
- [Supabase](https://supabase.com) (Auth, PostgreSQL, Row Level Security)
- [Tailwind CSS](https://tailwindcss.com)
