# Homework Board

A daily homework posting site for admins and students. Built with Next.js, Supabase, and Google Gemini AI.

## Features

- **Student accounts** — sign up, view homework posts, comment, and receive notifications
- **Admin accounts** — post daily homework, send notifications to all students or individuals, delete posts
- **Comments** — all authenticated users can comment on any post
- **Checklist** — students tick off homework when done; progress is saved per student
- **Reminders** — admins send homework reminders to all students, individuals, or only those who haven't completed specific tasks
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
2. Run the SQL migrations in the `supabase/` directory in the Supabase SQL Editor
3. Copy your project URL and anon key from Supabase Settings → API

### 4. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in the values:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
ADMIN_ACCESS_CODE=your-16-character-code
GOOGLE_GEMINI_API_KEY=your-gemini-api-key
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

## Deploy

Deploy to [Vercel](https://vercel.com) and add the same environment variables from `.env.local`.

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
