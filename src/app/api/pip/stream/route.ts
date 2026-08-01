import { NextRequest } from "next/server";
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
import { DAILY_LIMIT } from "@/lib/pip-types";

const CONFIRM_REGEX = /\[CONFIRM:([^|\]]+)\|([^|\]]+)\|label=([^\]]+)\]/g;

function parseConfirmActions(
  reply: string,
): { cleanReply: string; actions: { type: string; params: Record<string, string>; label: string }[] } {
  const actions: { type: string; params: Record<string, string>; label: string }[] = [];
  const cleanReply = reply.replace(CONFIRM_REGEX, (_match, type, paramsStr, label) => {
    const actionType = type.trim();
    if (actionType !== "mark_complete" && actionType !== "unmark_complete") return "";

    const params: Record<string, string> = {};
    for (const pair of paramsStr.split(",")) {
      const [k, ...v] = pair.split("=");
      if (k && v.length > 0) params[k.trim()] = v.join("=").trim();
    }
    if ((actionType === "mark_complete" || actionType === "unmark_complete") && params.post_id) {
      actions.push({ type: actionType, params, label: label.trim() || (actionType === "mark_complete" ? "Mark complete" : "Unmark complete") });
    }
    return "";
  });
  return { cleanReply: cleanReply.replace(/\n{3,}/g, "\n\n").trim(), actions };
}

async function buildUserContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string> {
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const [{ data: posts }, { data: completions }, { data: notifications }, { data: profile }] =
    await Promise.all([
      supabase.from("posts").select("id, title, subject, due_at, content").order("due_at", { ascending: true, nullsFirst: false }).limit(100),
      supabase.from("post_completions").select("post_id").eq("user_id", userId),
      supabase.from("notifications").select("id, read_at").eq("user_id", userId).is("read_at", null),
      supabase.from("profiles").select("full_name, role").eq("id", userId).single(),
    ]);

  type PostRow = { id: string; title: string; subject: string; due_at: string | null; content: string };
  const typedPosts = (posts ?? []) as PostRow[];
  const completedSet = new Set((completions ?? []).map((c: { post_id: string }) => c.post_id));

  const totalPosts = typedPosts.length;
  const completedCount = typedPosts.filter((p) => completedSet.has(p.id)).length;

  const subjectMap = new Map<string, { total: number; done: number }>();
  for (const p of typedPosts) {
    const key = p.subject ?? DEFAULT_SUBJECT;
    const entry = subjectMap.get(key) ?? { total: 0, done: 0 };
    entry.total += 1;
    if (completedSet.has(p.id)) entry.done += 1;
    subjectMap.set(key, entry);
  }
  const subjectLines = Array.from(subjectMap.entries()).map(([subj, { total, done }]) => `${subj}: ${done}/${total} done`);

  const upcoming = typedPosts
    .filter((p) => p.due_at && p.due_at >= todayStr && !completedSet.has(p.id))
    .slice(0, 10)
    .map((p) => `  - [${p.id}] ${p.title} (${p.subject}, due ${p.due_at})\n    ${p.content.slice(0, 200)}${p.content.length > 200 ? "..." : ""}`);

  const overdue = typedPosts
    .filter((p) => p.due_at && p.due_at < todayStr && !completedSet.has(p.id))
    .slice(0, 5)
    .map((p) => `  - [${p.id}] ${p.title} (${p.subject}, overdue since ${p.due_at})\n    ${p.content.slice(0, 200)}${p.content.length > 200 ? "..." : ""}`);

  const completed = typedPosts
    .filter((p) => completedSet.has(p.id))
    .slice(-10)
    .map((p) => `  - [${p.id}] ${p.title} (${p.subject})`);

  const userName = (profile as { full_name?: string; role?: string } | null)?.full_name ?? "Student";
  const userRole = (profile as { full_name?: string; role?: string } | null)?.role ?? "student";

  return `## Your homework data (use these exact IDs for CONFIRM markers)

### Profile
Name: ${userName}
Role: ${userRole}
Overall progress: ${completedCount}/${totalPosts} posts completed
Unread notifications: ${(notifications ?? []).length}

### Subject breakdown
${subjectLines.join("\n")}

${upcoming.length > 0 ? `### Upcoming (each prefixed with its post ID in brackets)\n${upcoming.join("\n")}\n` : ""}\
${overdue.length > 0 ? `### Overdue — tackle these first! (each prefixed with its post ID)\n${overdue.join("\n")}\n` : ""}\
${completed.length > 0 ? `### Recently completed\n${completed.join("\n")}` : ""}`;
}

function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(sseEvent({ type: "error", message: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  }

  let body: { question?: string; chatId?: string; systemInstructions?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(sseEvent({ type: "error", message: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  }

  const { question, chatId, systemInstructions } = body;

  // Input validation
  const trimmed = (question ?? "").trim();
  if (!trimmed) {
    return new Response(sseEvent({ type: "error", message: "Ask Pip something!" }), {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  }
  if (trimmed.length > 500) {
    return new Response(sseEvent({ type: "error", message: "Message is too long (max 500 characters)." }), {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  }

  // Profanity gate
  const profanity = tripProfanity({ userId: user.id }, trimmed);
  if (profanity.triggered) {
    return new Response(sseEvent({ type: "error", message: "Profanity detected", redirect: profanity.redirectUrl }), {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  }

  const todayStr = format(new Date(), "yyyy-MM-dd");

  // Rate limit + context in parallel
  const [rpcResult, contextPromise] = await Promise.allSettled([
    supabase.rpc("pip_try_increment", { p_date: todayStr, p_limit: DAILY_LIMIT }),
    buildUserContext(supabase, user.id),
  ]);

  let remaining: number;

  if (rpcResult.status !== "fulfilled") {
    return new Response(sseEvent({ type: "error", message: "Rate limit check failed" }), {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  }

  const { data: newCount, error: rpcError } = rpcResult.value;
  if (rpcError) {
    return new Response(sseEvent({ type: "error", message: "Rate limit check failed" }), {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  }

  if (newCount === null) {
    const { data: usage } = await supabase
      .from("pip_prompts")
      .select("count")
      .eq("user_id", user.id)
      .eq("prompt_date", todayStr)
      .maybeSingle();
    const used = (usage as { count?: number } | null)?.count ?? DAILY_LIMIT;
    remaining = Math.max(0, DAILY_LIMIT - used);
    return new Response(sseEvent({ type: "error", message: `You've used all ${DAILY_LIMIT} daily prompts.`, remaining }), {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  }

  remaining = DAILY_LIMIT - (newCount as number);

  const userContext = contextPromise.status === "fulfilled" ? contextPromise.value : "User context unavailable.";

  // API key check
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(sseEvent({ type: "error", message: "Gemini API key not configured.", remaining }), {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  }

  // Load history
  const historyContents: Array<{ role: "user" | "model"; parts: { text: string }[] }> = [];
  let dbInstructions: string | null = null;
  if (chatId) {
    try {
      const [prevMessages, instructions] = await Promise.all([
        getMessages(chatId),
        systemInstructions !== undefined ? Promise.resolve(systemInstructions) : getChatInstructions(chatId),
      ]);
      dbInstructions = instructions;
      for (const msg of prevMessages.slice(-20)) {
        historyContents.push({ role: msg.role === "user" ? "user" : "model", parts: [{ text: msg.text }] });
      }
    } catch { /* proceed without history */ }
  }

  const effectiveInstructions = systemInstructions?.trim() || dbInstructions?.trim() || null;

  // Build system prompt
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
- Use **bold** for emphasis, - for lists, and \`code\` for technical terms — markdown formatting is supported.

AVAILABLE ACTIONS — you can suggest these by ending your message with a special marker:
- To suggest marking a post complete: [CONFIRM:mark_complete|post_id=THE_UUID|label=✅ Mark complete]
- To suggest unmarking a post: [CONFIRM:unmark_complete|post_id=THE_UUID|label=↩ Unmark]
Only suggest an action when it's clearly helpful. Always put the marker at the very end of your message, on its own line. Use the exact post IDs from the context above.`;

  // Create a ReadableStream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let fullReply = "";

      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

        const contents = [
          { role: "user" as const, parts: [{ text: systemPrompt }] },
          { role: "model" as const, parts: [{ text: "Got it! I'm Pip, your homework assistant. I have all your homework data loaded. What can I help with?" }] },
          ...historyContents,
          { role: "user" as const, parts: [{ text: trimmed }] },
        ];

        const result = await model.generateContentStream({ contents });

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            fullReply += text;
            controller.enqueue(encoder.encode(sseEvent({ type: "token", text })));
          }
        }

        // Parse confirmation actions
        const { cleanReply, actions } = parseConfirmActions(fullReply);

        // Save messages to DB
        if (chatId) {
          try {
            await Promise.all([
              saveMessage(chatId, "user", trimmed),
              saveMessage(chatId, "pip", cleanReply),
            ]);
            if (historyContents.length === 0) {
              const title = trimmed.length > 50 ? trimmed.slice(0, 47) + "..." : trimmed;
              await renameChat(chatId, title);
            }
          } catch { /* non-critical */ }
        }

        controller.enqueue(
          encoder.encode(
            sseEvent({
              type: "done",
              remaining,
              confirmActions: actions.length > 0 ? actions : undefined,
            }),
          ),
        );
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("Pip stream error:", msg);
        if (msg.includes("quota")) {
          controller.enqueue(encoder.encode(sseEvent({ type: "error", message: "Gemini quota exceeded. Try again later.", remaining })));
        } else {
          controller.enqueue(encoder.encode(sseEvent({ type: "error", message: "Pip ran into a problem. Try again.", remaining })));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
