"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface PipChat {
  id: string;
  title: string;
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
    .select("id, title, created_at, updated_at")
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

export async function createChat(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("pip_chats")
    .insert({ user_id: user.id, title: "New chat" })
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

  await supabase
    .from("pip_chats")
    .update({ title: title.trim().slice(0, 80) || "New chat", updated_at: new Date().toISOString() })
    .eq("id", chatId)
    .eq("user_id", user.id);

  revalidatePath("/pip");
}

export async function saveMessage(chatId: string, role: "user" | "pip", text: string): Promise<void> {
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

  if (!chat) return;

  await supabase.from("pip_messages").insert({ chat_id: chatId, role, text });

  // Bump updated_at on the chat
  await supabase
    .from("pip_chats")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", chatId);
}
