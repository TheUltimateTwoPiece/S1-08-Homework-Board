"use server";

import { redirect } from "next/navigation";
import { format } from "date-fns";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SUBJECT } from "@/lib/subjects";
import { tripProfanity } from "@/lib/profanity";
import {
  getMessages,
  saveMessage,
  renameChat,
  getChatInstructions,
} from "@/actions/pip-chats";
import {
  DAILY_LIMIT,
  type ConfirmAction,
  type PipResult,
} from "@/lib/pip-types";

// ── Regex to parse [CONFIRM:type|key=val,...|label=text] markers ──
const CONFIRM_REGEX = /\[CONFIRM:([^|\]]+)\|([^|\]]+)\|label=([^\]]+)\]/g;

function parseConfirmActions(reply: string): {
  cleanReply: string;
  actions: ConfirmAction[];
} {
  const actions: ConfirmAction[] = [];
  const cleanReply = reply.replace(CONFIRM_REGEX, (_match, type, paramsStr, label) => {
    const actionType = type.trim();
    if (actionType !== "mark_complete" && actionType !== "unmark_complete") {
      return ""; // unknown action — strip silently
    }

    const params: Record<string, string> = {};
    for (const pair of paramsStr.split(",")) {
      const [k, ...v] = pair.split("=");
      if (k && v.length > 0) params[k.trim()] = v.join("=").trim();
    }

    // Only add if it has the required params
    if ((actionType === "mark_complete" || actionType === "unmark_complete") && params.post_id) {
      actions.push({
        type: actionType as ConfirmAction["type"],
        params,
        label: label.trim() || (actionType === "mark_complete" ? "Mark complete" : "Unmark complete"),
      });
    }

    return ""; // strip the marker from visible text
  });

  // Clean up double newlines left by removed markers
  return {
    cleanReply: cleanReply.replace(/\n{3,}/g, "\n\n").trim(),
    actions,
  };
}

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

  const subjectLines = Array.from(subjectMap.entries()).map(
    ([subj, { total, done }]) => `${subj}: ${done}/${total} done`,
  );

  // Upcoming (due today or later, not completed) — include content snippet
  const upcoming = typedPosts
    .filter((p) => p.due_at && p.due_at >= todayStr && !completedSet.has(p.id))
    .slice(0, 10)
    .map(
      (p) =>
        `  - ${p.title} (${p.subject}, due ${p.due_at})\n    ${p.content.slice(0, 200)}${p.content.length > 200 ? "..." : ""}`,
    );

  // Overdue — include content snippet
  const overdue = typedPosts
    .filter((p) => p.due_at && p.due_at < todayStr && !completedSet.has(p.id))
    .slice(0, 5)
    .map(
      (p) =>
        `  - ${p.title} (${p.subject}, overdue since ${p.due_at})\n    ${p.content.slice(0, 200)}${p.content.length > 200 ? "..." : ""}`,
    );

  // Completed — last 10 for reference
  const completed = typedPosts
    .filter((p) => completedSet.has(p.id))
    .slice(-10)
    .map((p) => `  - ${p.title} (${p.subject})`);

  const userName =
    (profile as { full_name?: string; role?: string } | null)?.full_name ??
    "Student";
  const userRole =
    (profile as { full_name?: string; role?: string } | null)?.role ?? "student";

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

export async function askPip(
  question: string,
  chatId?: string,
  systemInstructions?: string,
): Promise<PipResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
  const { data: newCount, error: rpcError } = await supabase.rpc(
    "pip_try_increment",
    {
      p_date: todayStr,
      p_limit: DAILY_LIMIT,
    },
  );

  if (rpcError) {
    console.error("Pip RPC error:", rpcError);
    const msg = String(rpcError.message ?? rpcError.code ?? rpcError);
    if (
      msg.includes("Could not find") ||
      msg.includes("function") ||
      msg.includes("404")
    ) {
      return {
        error:
          "Pip isn't fully set up yet. Run the pip-prompts migration in Supabase.",
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
    return {
      error: "Gemini API key is not configured. Set GOOGLE_GEMINI_API_KEY.",
      remaining,
    };
  }

  let userContext: string;
  try {
    userContext = await buildUserContext(supabase, user.id);
  } catch {
    userContext = "User context unavailable.";
  }

  // Load previous messages from DB for multi-turn context
  const historyContents: Array<{
    role: "user" | "model";
    parts: { text: string }[];
  }> = [];
  let dbInstructions: string | null = null;
  if (chatId) {
    try {
      const [prevMessages, instructions] = await Promise.all([
        getMessages(chatId),
        systemInstructions !== undefined
          ? Promise.resolve(systemInstructions)
          : getChatInstructions(chatId),
      ]);
      dbInstructions = instructions;
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

  // Custom instructions take priority: passed-in > DB-stored
  const effectiveInstructions =
    systemInstructions?.trim() || dbInstructions?.trim() || null;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite",
    });

    const systemPrompt = `You are Pip, a friendly and helpful homework assistant for students. You have access to the student's real homework data (completion status, upcoming due dates, subject breakdown, notifications, and the full instructions for each assignment).

Your personality: encouraging, concise, and slightly playful. Use emoji sparingly. Keep answers short but helpful — students are busy.
${effectiveInstructions ? `\nCUSTOM INSTRUCTIONS FROM THE STUDENT (follow these above all else):\n${effectiveInstructions}\n` : ""}
${userContext}

Guidelines:
- Answer questions about the student's homework, progress, and deadlines.
- When the student asks about a specific assignment, share the actual instructions/details from the context — you have the post content!
- If they ask about something not in their data, say so honestly.
- Encourage them to complete overdue work first.
- Celebrate milestones (all caught up, finishing a subject, etc.).
- Never make up data. Only reference what's in the context above.
- Keep responses under 3 paragraphs unless the question demands detail.

AVAILABLE ACTIONS — you can suggest these by ending your message with a special marker:
- To suggest marking a post complete: [CONFIRM:mark_complete|post_id=THE_UUID|label=✅ Mark complete]
- To suggest unmarking a post: [CONFIRM:unmark_complete|post_id=THE_UUID|label=↩ Unmark]
Only suggest an action when it's clearly helpful. Always put the marker at the very end of your message, on its own line. Use the exact post IDs from the context above.`;

    const contents = [
      { role: "user" as const, parts: [{ text: systemPrompt }] },
      {
        role: "model" as const,
        parts: [
          {
            text: "Got it! I'm Pip, your homework assistant. I have all your homework data loaded, including the full instructions for each assignment. What can I help with?",
          },
        ],
      },
      ...historyContents,
      { role: "user" as const, parts: [{ text: trimmed }] },
    ];

    const result = await model.generateContent({ contents });
    const rawReply = result.response.text();

    // Parse confirmation actions from the reply
    const { cleanReply, actions } = parseConfirmActions(rawReply);

    // Save messages to DB if we have a chatId (save the clean reply)
    if (chatId) {
      try {
        await saveMessage(chatId, "user", trimmed);
        await saveMessage(chatId, "pip", cleanReply);
        // Auto-title: use first user message if chat is still "New chat"
        const prevMessages = await getMessages(chatId);
        if (prevMessages.length <= 2) {
          const title =
            trimmed.length > 50 ? trimmed.slice(0, 47) + "..." : trimmed;
          await renameChat(chatId, title);
        }
      } catch {
        // Non-critical — the messages will still appear in the UI this session
      }
    }

    return {
      reply: cleanReply,
      remaining,
      confirmActions: actions.length > 0 ? actions : undefined,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Pip error:", message);

    if (message.includes("API key")) {
      return {
        error: "Gemini API key is invalid. Check GOOGLE_GEMINI_API_KEY.",
        remaining,
      };
    }
    if (message.includes("quota")) {
      return { error: "Gemini quota exceeded. Try again later.", remaining };
    }

    return { error: "Pip ran into a problem. Try again.", remaining };
  }
}
