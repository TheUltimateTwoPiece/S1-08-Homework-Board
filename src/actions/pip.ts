"use server";

import { redirect } from "next/navigation";
import { format } from "date-fns";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SUBJECT } from "@/lib/subjects";
import { tripProfanity } from "@/lib/profanity";
import { getMessages, saveMessage, renameChat } from "@/actions/pip-chats";
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
      .select("id, title, subject, due_at, content")
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
    content: string;
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

  // Upcoming (due today or later, not completed) — include content snippet
  const upcoming = typedPosts
    .filter((p) => p.due_at && p.due_at >= todayStr && !completedSet.has(p.id))
    .slice(0, 10)
    .map((p) => `  - ${p.title} (${p.subject}, due ${p.due_at})\n    ${p.content.slice(0, 200)}${p.content.length > 200 ? "..." : ""}`);

  // Overdue — include content snippet
  const overdue = typedPosts
    .filter((p) => p.due_at && p.due_at < todayStr && !completedSet.has(p.id))
    .slice(0, 5)
    .map((p) => `  - ${p.title} (${p.subject}, overdue since ${p.due_at})\n    ${p.content.slice(0, 200)}${p.content.length > 200 ? "..." : ""}`);

  // Completed — last 10 for reference
  const completed = typedPosts
    .filter((p) => completedSet.has(p.id))
    .slice(-10)
    .map((p) => `  - ${p.title} (${p.subject})`);

  const userName = (profile as { full_name?: string; role?: string } | null)?.full_name ?? "Student";
  const userRole = (profile as { full_name?: string; role?: string } | null)?.role ?? "student";

  return `## User context (for your reference — do NOT repeat this verbatim)
Name: ${userName}
Role: ${userRole}
Homework completion: ${completedCount}/${totalPosts} posts completed
Unread notifications: ${unreadCount}

Subject breakdown:
${subjectLines.join("\n")}

${upcoming.length > 0 ? `Upcoming due (with instructions):\n${upcoming.join("\n")}` : ""}
${overdue.length > 0 ? `Overdue (with instructions):\n${overdue.join("\n")}` : ""}
${completed.length > 0 ? `Recently completed:\n${completed.join("\n")}` : ""}`;
}

export async function askPip(question: string, chatId?: string): Promise<PipResult> {
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
  const { data: newCount, error: rpcError } = await supabase
    .rpc("pip_try_increment", {
      p_date: todayStr,
      p_limit: DAILY_LIMIT,
    });

  if (rpcError) {
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

  // ── Step 2: Call Gemini with full chat history ──
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

  // Load previous messages from DB for multi-turn context
  let historyContents: Array<{ role: "user" | "model"; parts: { text: string }[] }> = [];
  if (chatId) {
    try {
      const prevMessages = await getMessages(chatId);
      // Convert DB messages to Gemini format (limited to last 20 to avoid token bloat)
      const recent = prevMessages.slice(-20);
      for (const msg of recent) {
        historyContents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.text }],
        });
      }
    } catch {
      // If history fetch fails, proceed without it — better than crashing
    }
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

    const systemPrompt = `You are Pip, a friendly and helpful homework assistant for students. You have access to the student's real homework data (completion status, upcoming due dates, subject breakdown, notifications, and the full instructions for each assignment).

Your personality: encouraging, concise, and slightly playful. Use emoji sparingly. Keep answers short but helpful — students are busy.

${userContext}

Guidelines:
- Answer questions about the student's homework, progress, and deadlines.
- When the student asks about a specific assignment, share the actual instructions/ details from the context — you have the post content!
- If they ask about something not in their data, say so honestly.
- Encourage them to complete overdue work first.
- Celebrate milestones (all caught up, finishing a subject, etc.).
- Never make up data. Only reference what's in the context above.
- Keep responses under 3 paragraphs unless the question demands detail.`;

    const contents = [
      { role: "user" as const, parts: [{ text: systemPrompt }] },
      { role: "model" as const, parts: [{ text: "Got it! I'm Pip, your homework assistant. I have all your homework data loaded, including the full instructions for each assignment. What can I help with?" }] },
      ...historyContents,
      { role: "user" as const, parts: [{ text: trimmed }] },
    ];

    const result = await model.generateContent({ contents });
    const reply = result.response.text();

    // Save messages to DB if we have a chatId
    if (chatId) {
      try {
        await saveMessage(chatId, "user", trimmed);
        await saveMessage(chatId, "pip", reply);
        // Auto-title: use first user message if chat is still "New chat"
        const prevMessages = await getMessages(chatId);
        if (prevMessages.length <= 2) {
          const title = trimmed.length > 50 ? trimmed.slice(0, 47) + "..." : trimmed;
          await renameChat(chatId, title);
        }
      } catch {
        // Non-critical — the messages will still appear in the UI this session
      }
    }

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
