"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { tripProfanity } from "@/lib/profanity";
import { redirect } from "next/navigation";

const MAX_AI_CONTENT_LENGTH = 20000;

export async function enhanceContentWithAI(content: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return { error: "Only admins can use post enhancement." };

  const normalizedContent = typeof content === "string" ? content.trim() : "";
  if (!normalizedContent) return { error: "Enter some content first." };
  if (normalizedContent.length > MAX_AI_CONTENT_LENGTH) {
    return { error: `Content is too long (max ${MAX_AI_CONTENT_LENGTH} characters).` };
  }

  const profanity = tripProfanity({ userId: user.id }, normalizedContent);
  if (profanity.triggered) redirect(profanity.redirectUrl);

  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

  if (!apiKey) {
    return { error: "Google Gemini API key is not configured." };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

    const prompt = `You are a helpful assistant for teachers. Format and improve the following homework assignment content.
Make it clearer, more organized, and student-friendly. Keep the core information intact but improve:
- Clarity and readability
- Organization (use bullet points, numbered lists where appropriate)
- Tone (make it encouraging and clear)
- Structure (add sections if needed)

Original content:
${normalizedContent}

Return only the improved content, no additional commentary.`;

    const result = await model.generateContent(prompt);
    const enhancedContent = result.response.text();

    return { success: true, content: enhancedContent };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    console.error("AI enhancement error:", message);

    const lower = message.toLowerCase();
    const userMessage = lower.includes("quota") || lower.includes("429")
      ? "Gemini quota exceeded. Try again later."
      : lower.includes("api key") || lower.includes("unauthorized") || lower.includes("forbidden")
        ? "Gemini is not configured correctly. Check the server API key."
        : "AI enhancement failed. Try again.";
    return { error: userMessage };
  }
}
