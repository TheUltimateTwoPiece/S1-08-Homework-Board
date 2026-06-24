"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

export async function enhanceContentWithAI(content: string) {
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
${content}

Return only the improved content, no additional commentary.`;

    const result = await model.generateContent(prompt);
    const enhancedContent = result.response.text();

    return { success: true, content: enhancedContent };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    console.error("AI enhancement error:", message);

    if (message.includes("API key")) {
      return { error: "Invalid Google Gemini API key. Please check your .env.local file." };
    }
    if (message.includes("quota")) {
      return { error: "API quota exceeded. Please check your Google Cloud usage." };
    }
    if (message.includes("model")) {
      return { error: "Model not available. Please check your API configuration." };
    }

    return { error: `Failed to enhance content: ${message || "Unknown error"}` };
  }
}
