import { NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { tripProfanity } from "@/lib/profanity";
import {
  getMessages,
  saveMessage,
  renameChat,
  getChatInstructions,
} from "@/actions/pip-chats";
import {
  buildUserContext,
  buildSystemPrompt,
  parseConfirmActions,
} from "@/lib/pip-context";
import { DAILY_LIMIT } from "@/lib/pip-types";
import { getPromptDateString } from "@/lib/time";
import {
  acquireInFlight,
  cooldownRemainingSeconds,
  getCachedReply,
  isCoolingDown,
  markQuotaExhausted,
  putCachedReply,
  releaseInFlight,
} from "@/lib/pip-cost-guard";

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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return new Response(sseEvent({ type: "error", message: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  }

  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    return new Response(sseEvent({ type: "error", message: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  }

  const body = rawBody as { question?: unknown; chatId?: unknown; systemInstructions?: unknown };
  const question = typeof body.question === "string" ? body.question : "";
  const chatId = typeof body.chatId === "string" ? body.chatId.trim() || undefined : undefined;
  const systemInstructions = typeof body.systemInstructions === "string"
    ? body.systemInstructions
    : undefined;

  const trimmed = question.trim();
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

  const instructions = typeof systemInstructions === "string" ? systemInstructions.trim() : "";
  if (instructions.length > 300) {
    return new Response(sseEvent({ type: "error", message: "Instructions are too long (max 300 characters)." }), {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  }
  const instructionProfanity = tripProfanity({ userId: user.id }, instructions);
  if (instructionProfanity.triggered) {
    return new Response(sseEvent({ type: "error", message: "Profanity detected", redirect: instructionProfanity.redirectUrl }), {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  }

  const profanity = tripProfanity({ userId: user.id }, trimmed);
  if (profanity.triggered) {
    return new Response(sseEvent({ type: "error", message: "Profanity detected", redirect: profanity.redirectUrl }), {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  }

  const todayStr = getPromptDateString();

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

  if (isCoolingDown()) {
    return new Response(
      sseEvent({ type: "error", message: `Gemini is busy recovering. Try again in ${cooldownRemainingSeconds()}s.`, remaining }),
      { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } },
    );
  }

  if (contextPromise.status !== "fulfilled") {
    return new Response(
      sseEvent({
        type: "error",
        message: "Pip couldn't load your current homework data. Please try again.",
        remaining,
      }),
      { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } },
    );
  }

  const userContext = contextPromise.value;
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(sseEvent({ type: "error", message: "Gemini API key not configured.", remaining }), {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  }

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

  const effectiveInstructions = instructions || dbInstructions?.trim() || null;

  const cachedReply = getCachedReply(user.id, trimmed);
  if (cachedReply !== null) {
    return new Response(
      sseEvent({ type: "token", text: cachedReply }) + sseEvent({ type: "done", remaining }),
      { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } },
    );
  }

  const systemPrompt = buildSystemPrompt(userContext, effectiveInstructions);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let fullReply = "";
      let lockHeld = false;

      try {
        if (!acquireInFlight(user.id)) {
          controller.enqueue(encoder.encode(sseEvent({ type: "error", message: "You already have a reply on the way. Wait for it to finish.", remaining })));
          return;
        }
        lockHeld = true;

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: "gemini-3.1-flash-lite",
          systemInstruction: systemPrompt,
        });

        const contents = [
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

        const { cleanReply, actions } = parseConfirmActions(fullReply);
        if (actions.length === 0) putCachedReply(user.id, trimmed, cleanReply);

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
            sseEvent({ type: "done", remaining, confirmActions: actions.length > 0 ? actions : undefined }),
          ),
        );
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("Pip stream error:", msg);
        const lower = msg.toLowerCase();
        if (lower.includes("quota") || lower.includes("429") || lower.includes("resource exhausted")) {
          markQuotaExhausted();
        }
        const message = lower.includes("quota") || lower.includes("429") || lower.includes("resource exhausted")
          ? "Gemini quota exceeded. Try again later."
          : lower.includes("api key") || lower.includes("unauthorized") || lower.includes("forbidden")
            ? "Pip is not configured correctly. Please contact an admin."
            : "Pip ran into a problem. Try again.";
        controller.enqueue(encoder.encode(sseEvent({ type: "error", message, remaining })));
      } finally {
        if (lockHeld) releaseInFlight(user.id);
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
