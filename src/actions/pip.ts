"use server";

import { redirect } from "next/navigation";
import { format } from "date-fns";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SUBJECT } from "@/lib/subjects";
import { tripProfanity } from "@/lib/profanity";
import { DAILY_LIMIT, type PipResult } from "@/lib/pip-types";

/**
 * Builds a structured snapshot of the user's homework data to inject
 * into the Gemini system prompt so Pip can answer personalised questions.
 */
async function buildUserContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string> {
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const [
    { data: posts },
    { data: completions },
    { data: notifications },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from("posts")
      .select("id, title, subject, due_at")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(100),
    supabase
      .from("post_completions")
      .select("post_id")
      .eq("user_id", userId),
    supabase
      .from("notifications")
      .select("id, read_at")
      .eq("user_id", userId)
      .is("read_at", null),
    supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", userId)
      .single(),
  ]);

  const typedPosts = (posts ?? []) as Array<{
    id: string;
    title: string;
    subject: string;
    due_at: string | null;
  }>;

  const completedSet = new Set(
    (completions ?? []).map((c: { post_id: string }) => c.post_id),
  );

  const totalPosts = typedPosts.length;
  const completedCount = typedPosts.filter((p) => completedSet.has(p.id)).length;
  const unreadCount = (notifications ?? []).length;

  // Subject breakdown
  const subjectMap = new Map<string, { total: number; done: number }>();
  for (const p of typedPosts) {
    const key = p.subject ?? DEFAULT_SUBJECT;
    const entry = subjectMap.get(key) ?? { total: 0, done: 0 };
    entry.total += 1;
    if (completedSet.has(p.id)) entry.done += 1;
    subjectMap.set(key, entry);
  }

  const subjectLines = Array.from(subjectMap.entries())
    .map(([subj, { total, done }]) => `${subj}: ${done}/${total} done`);

  // Upcoming (due today or later, not completed)
  const upcoming = typedPosts
    .filter((p) => p.due_at && p.due_at >= todayStr && !completedSet.has(p.id))
    .slice(0, 10)
    .map((p) => `  - ${p.title} (${p.subject}, due ${p.due_at})`);

  // Overdue
  const overdue = typedPosts
    .filter((p) => p.due_at && p.due_at < todayStr && !completedSet.has(p.id))
    .slice(0, 5)
    .map((p) => `  - ${p.title} (${p.subject}, overdue since ${p.due_at})`);

  const userName = (profile as { full_name?: string; role?: string } | null)?.full_name ?? "Student";
  const userRole = (profile as { full_name?: string; role?: string } | null)?.role ?? "student";

  return `## User context (for your reference — do NOT repeat this verbatim)
Name: ${userName}
Role: ${userRole}
Homework completion: ${completedCount}/${totalPosts} posts completed
Unread notifications: ${unreadCount}

Subject breakdown:
${subjectLines.join("\n")}

${upcoming.length > 0 ? `Upcoming due:\n${upcoming.join("\n")}` : ""}
${overdue.length > 0 ? `Overdue:\n${overdue.join("\n")}` : ""}`;
}

export async function askPip(question: string): Promise<PipResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // ── Server-side input validation ──
  const trimmed = question.trim();
  if (!trimmed) {
    return { error: "Ask Pip something!" };
  }
  if (trimmed.length > 500) {
    return { error: "Message is too long (max 500 characters)." };
  }

  // ── Profanity gate ──
  const profanity = tripProfanity({ userId: user.id }, trimmed);
  if (profanity.triggered) redirect(profanity.redirectUrl);

  const todayStr = format(new Date(), "yyyy-MM-dd");

  // ── Step 1: Atomic rate-limit check-and-increment ──
  // The RPC function pip_try_increment atomically inserts-or-updates only
  // if under the limit. It derives user_id from auth.uid() internally.
  const { data: newCount, error: rpcError } = await supabase
    .rpc("pip_try_increment", {
      p_date: todayStr,
      p_limit: DAILY_LIMIT,
    });

  if (rpcError) {
    // If the RPC function doesn't exist yet (migration not run), give a
    // clear error instead of a misleading "limit reached" message.
    console.error("Pip RPC error:", rpcError);
    const msg = String(rpcError.message ?? rpcError.code ?? rpcError);
    if (msg.includes("Could not find") || msg.includes("function") || msg.includes("404")) {
      return {
        error: "Pip isn't fully set up yet. Run the pip-prompts migration in Supabase.",
      };
    }
    return { error: "Something went wrong with rate limiting. Try again." };
  }

  if (newCount === null) {
    // Limit reached — fetch actual count for an accurate remaining display
    const { data: usage } = await supabase
      .from("pip_prompts")
      .select("count")
      .eq("user_id", user.id)
      .eq("prompt_date", todayStr)
      .maybeSingle();

    const used = (usage as { count?: number } | null)?.count ?? DAILY_LIMIT;
    return {
      error: `You've used all ${DAILY_LIMIT} daily prompts. Resets at midnight UTC.`,
      remaining: Math.max(0, DAILY_LIMIT - used),
    };
  }

  const remaining = DAILY_LIMIT - (newCount as number);

  // ── Step 2: Call Gemini ──
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    return { error: "Gemini API key is not configured. Set GOOGLE_GEMINI_API_KEY.", remaining };
  }

  let userContext: string;
  try {
    userContext = await buildUserContext(supabase, user.id);
  } catch {
    userContext = "User context unavailable.";
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

    const systemPrompt = `You are Pip, a friendly and helpful homework assistant for students. You have access to the student's real homework data (completion status, upcoming due dates, subject breakdown, notifications).

Your personality: encouraging, concise, and slightly playful. Use emoji sparingly. Keep answers short but helpful — students are busy.

${userContext}

Guidelines:
- Answer questions about the student's homework, progress, and deadlines.
- If they ask about something not in their data, say so honestly.
- Encourage them to complete overdue work first.
- Celebrate milestones (all caught up, finishing a subject, etc.).
- Never make up data. Only reference what's in the context above.
- Keep responses under 3 paragraphs unless the question demands detail.`;

    const result = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Got it! I'm Pip, your homework assistant. I have all your homework data loaded. What can I help with?" }] },
        { role: "user", parts: [{ text: trimmed }] },
      ],
    });

    const reply = result.response.text();

    return { reply, remaining };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Pip error:", message);

    if (message.includes("API key")) {
      return { error: "Gemini API key is invalid. Check GOOGLE_GEMINI_API_KEY.", remaining };
    }
    if (message.includes("quota")) {
      return { error: "Gemini quota exceeded. Try again later.", remaining };
    }

    return { error: "Pip ran into a problem. Try again.", remaining };
  }
}
