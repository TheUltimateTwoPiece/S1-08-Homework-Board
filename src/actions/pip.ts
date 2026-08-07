"use server";

import { redirect } from "next/navigation";
import { format } from "date-fns";
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
import {
  DAILY_LIMIT,
  type PipResult,
} from "@/lib/pip-types";

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

  const trimmed = question.trim();
  if (!trimmed) return { error: "Ask Pip something!" };
  if (trimmed.length > 500) return { error: "Message is too long (max 500 characters)." };

  const profanity = tripProfanity({ userId: user.id }, trimmed);
  if (profanity.triggered) redirect(profanity.redirectUrl);

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const [rpcResult, contextPromise] = await Promise.allSettled([
    supabase.rpc("pip_try_increment", { p_date: todayStr, p_limit: DAILY_LIMIT }),
    buildUserContext(supabase, user.id),
  ]);

  let newCount: number | null = null;
  if (rpcResult.status === "fulfilled") {
    const { data, error } = rpcResult.value;
    if (error) {
      console.error("Pip RPC error:", error);
      const msg = String(error.message ?? error.code ?? error);
      if (msg.includes("Could not find") || msg.includes("function") || msg.includes("404")) {
        return { error: "Pip isn't fully set up yet. Run the pip-prompts migration in Supabase." };
      }
      return { error: "Something went wrong with rate limiting. Try again." };
    }
    newCount = data;
  } else {
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

  const userContext =
    contextPromise.status === "fulfilled" ? contextPromise.value : "User context unavailable.";

  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    return { error: "Gemini API key is not configured. Set GOOGLE_GEMINI_API_KEY.", remaining };
  }

  const historyContents: Array<{ role: "user" | "model"; parts: { text: string }[] }> = [];
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
      for (const msg of prevMessages.slice(-20)) {
        historyContents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.text }],
        });
      }
    } catch { /* proceed without history */ }
  }

  const effectiveInstructions = systemInstructions?.trim() || dbInstructions?.trim() || null;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

    const systemPrompt = buildSystemPrompt(userContext, effectiveInstructions);

    const contents = [
      { role: "user" as const, parts: [{ text: systemPrompt }] },
      {
        role: "model" as const,
        parts: [{ text: "Got it! I'm Pip, your homework assistant. I have all your homework data loaded. What can I help with?" }],
      },
      ...historyContents,
      { role: "user" as const, parts: [{ text: trimmed }] },
    ];

    const result = await model.generateContent({ contents });
    const rawReply = result.response.text();
    const { cleanReply, actions } = parseConfirmActions(rawReply);

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

    return {
      reply: cleanReply,
      remaining,
      confirmActions: actions.length > 0 ? actions : undefined,
    };
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
