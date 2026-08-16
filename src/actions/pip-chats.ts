"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tripProfanity } from "@/lib/profanity";
import { MAX_PIP_INSTRUCTIONS_LENGTH } from "@/lib/pip-types";

const MAX_CHAT_INSTRUCTIONS_LENGTH = MAX_PIP_INSTRUCTIONS_LENGTH;
const MAX_CHAT_TITLE_LENGTH = 80;
const MAX_SAVED_MESSAGE_LENGTH = 12000;

export interface PipChat {
  id: string;
  title: string;
  system_instructions: string | null;
  created_at: string;
  updated_at: string;
}

export interface PipMessage {
  id: string;
  chat_id: string;
  role: "user" | "pip";
  text: string;
  created_at: string;
}

export async function getChats(): Promise<PipChat[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("pip_chats")
    .select("id, title, system_instructions, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return (data ?? []) as PipChat[];
}

export async function getMessages(chatId: string): Promise<PipMessage[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Verify ownership
  const { data: chat } = await supabase
    .from("pip_chats")
    .select("id")
    .eq("id", chatId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!chat) return [];

  const { data } = await supabase
    .from("pip_messages")
    .select("id, chat_id, role, text, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  return (data ?? []) as PipMessage[];
}

export async function createChat(
  systemInstructions?: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const instructions = systemInstructions?.trim() || null;
  if (instructions && instructions.length > MAX_CHAT_INSTRUCTIONS_LENGTH) return null;
  if (instructions) {
    const profanity = tripProfanity({ userId: user.id }, instructions);
    if (profanity.triggered) redirect(profanity.redirectUrl);
  }

  const { data } = await supabase
    .from("pip_chats")
    .insert({
      user_id: user.id,
      title: "New chat",
      system_instructions: instructions,
    })
    .select("id")
    .single();

  revalidatePath("/pip");
  return (data as { id: string } | null)?.id ?? null;
}

export async function deleteChat(chatId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("pip_chats")
    .delete()
    .eq("id", chatId)
    .eq("user_id", user.id);

  revalidatePath("/pip");
}

export async function renameChat(chatId: string, title: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const normalizedTitle = title.trim().slice(0, MAX_CHAT_TITLE_LENGTH) || "New chat";
  if (containsUnsafeChatText(normalizedTitle, user.id)) return;

  await supabase
    .from("pip_chats")
    .update({
      title: normalizedTitle,
      updated_at: new Date().toISOString(),
    })
    .eq("id", chatId)
    .eq("user_id", user.id);

  revalidatePath("/pip");
}

export async function updateInstructions(
  chatId: string,
  instructions: string,
): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const normalizedInstructions = instructions.trim();
  if (normalizedInstructions.length > MAX_CHAT_INSTRUCTIONS_LENGTH) return;
  if (normalizedInstructions && containsUnsafeChatText(normalizedInstructions, user.id)) return;

  await supabase
    .from("pip_chats")
    .update({
      system_instructions: normalizedInstructions || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", chatId)
    .eq("user_id", user.id);

  revalidatePath("/pip");
}

export async function getChatInstructions(
  chatId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("pip_chats")
    .select("system_instructions")
    .eq("id", chatId)
    .eq("user_id", user.id)
    .maybeSingle();

  return (data as { system_instructions: string | null } | null)
    ?.system_instructions ?? null;
}

export async function saveMessage(
  chatId: string,
  role: "user" | "pip",
  text: string,
): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const normalizedText = typeof text === "string" ? text.trim() : "";
  if (!normalizedText || normalizedText.length > MAX_SAVED_MESSAGE_LENGTH) return;
  if (role !== "user" && role !== "pip") return;
  if (role === "user" && containsUnsafeChatText(normalizedText, user.id)) return;

  // Verify ownership
  const { data: chat } = await supabase
    .from("pip_chats")
    .select("id")
    .eq("id", chatId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!chat) return;

  await supabase.from("pip_messages").insert({ chat_id: chatId, role, text: normalizedText });

  // Bump updated_at on the chat
  await supabase
    .from("pip_chats")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", chatId)
    .eq("user_id", user.id);
}

function containsUnsafeChatText(text: string, userId: string): boolean {
  return tripProfanity({ userId }, text).triggered;
}
