"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { askPip } from "@/actions/pip";
import { createChat, deleteChat, renameChat, getChats, getMessages, type PipChat } from "@/actions/pip-chats";
import { DAILY_LIMIT, type PipResult } from "@/lib/pip-types";

const WELCOME_TEXT = "Hey! I'm Pip, your homework assistant. I can see your assignments, due dates, and progress. Ask me anything — how you're doing, what's overdue, or what to tackle next!";

export function PipWidget({
  remaining: initialRemaining,
  initialChats,
}: {
  remaining: number;
  initialChats: PipChat[];
}) {
  const [chats, setChats] = useState<PipChat[]>(initialChats);
  const [activeChatId, setActiveChatId] = useState<string | null>(chats[0]?.id ?? null);
  // Cache messages per chat so switching back is instant
  const [messageCache, setMessageCache] = useState<Map<string, { role: "user" | "pip"; text: string; id?: string }[]>>(new Map());
  const messages = activeChatId ? (messageCache.get(activeChatId) ?? []) : [];
  // Ref mirror of the cache so the effect below only depends on activeChatId
  const cacheRef = useRef(messageCache);
  cacheRef.current = messageCache;
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const sendingRef = useRef(false); // synchronous guard against double-Enter
  const [remaining, setRemaining] = useState(initialRemaining);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  // Load messages when active chat changes — cached in messageCache.
  // Only depends on activeChatId (uses cacheRef to avoid wasteful re-runs).
  useEffect(() => {
    if (!activeChatId) return;
    if (cacheRef.current.has(activeChatId)) return; // already cached
    let cancelled = false;
    getMessages(activeChatId).then((msgs) => {
      if (cancelled) return;
      const loaded = msgs.length > 0
        ? msgs.map((m) => ({ role: m.role, text: m.text, id: m.id }))
        : [{ role: "pip" as const, text: WELCOME_TEXT }];
      setMessageCache((prev) => {
        const next = new Map(prev);
        next.set(activeChatId, loaded);
        return next;
      });
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: "instant" as ScrollBehavior });
      });
    });
    return () => { cancelled = true; };
  }, [activeChatId]);

  // Refresh chats list from server periodically or on focus
  const refreshChats = useCallback(async () => {
    const fresh = await getChats();
    setChats(fresh);
  }, []);

  async function handleNewChat() {
    const id = await createChat();
    if (id) {
      await refreshChats();
      setActiveChatId(id);
      setMessageCache((prev) => {
        const next = new Map(prev);
        next.set(id, [{ role: "pip", text: WELCOME_TEXT }]);
        return next;
      });
      setInput("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  async function handleDeleteChat(chatId: string, e: React.MouseEvent) {
    e.stopPropagation();
    await deleteChat(chatId);
    await refreshChats();
    // Evict from cache
    setMessageCache((prev) => {
      const next = new Map(prev);
      next.delete(chatId);
      return next;
    });
    if (activeChatId === chatId) {
      const other = chats.filter((c) => c.id !== chatId);
      setActiveChatId(other[0]?.id ?? null);
    }
  }

  async function handleRenameChat(chatId: string) {
    if (!titleDraft.trim()) {
      setEditingTitle(null);
      return;
    }
    await renameChat(chatId, titleDraft.trim());
    await refreshChats();
    setEditingTitle(null);
  }

  function startRename(chat: PipChat, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingTitle(chat.id);
    setTitleDraft(chat.title);
  }

  async function handleSend() {
    const question = input.trim();
    if (!question || loading || remaining <= 0 || sendingRef.current) return;
    sendingRef.current = true;

    // Auto-create a chat if none is active
    let chatId = activeChatId;
    if (!chatId) {
      const id = await createChat();
      if (!id) { sendingRef.current = false; return; }
      chatId = id;
      setActiveChatId(id);
      setMessageCache((prev) => {
        const next = new Map(prev);
        next.set(id, [{ role: "pip", text: WELCOME_TEXT }]);
        return next;
      });
      await refreshChats();
    }

    setMessageCache((prev) => {
      const next = new Map(prev);
      const current = next.get(chatId) ?? [];
      next.set(chatId, [...current, { role: "user", text: question }]);
      return next;
    });
    setInput("");
    setLoading(true);
    scrollToBottom();

    try {
      const result: PipResult = await askPip(question, chatId);
      setMessageCache((prev) => {
        const next = new Map(prev);
        const current = next.get(chatId) ?? [];
        if (result.reply) {
          next.set(chatId, [...current, { role: "pip", text: result.reply }]);
        } else if (result.error) {
          next.set(chatId, [...current, { role: "pip", text: `\u26a0\ufe0f ${result.error}` }]);
        }
        return next;
      });
      if (result.reply) await refreshChats();
      if (result.remaining !== undefined) setRemaining(result.remaining);
    } catch {
      setMessageCache((prev) => {
        const next = new Map(prev);
        const current = next.get(chatId) ?? [];
        next.set(chatId, [...current, { role: "pip", text: "Something went wrong. Try again?" }]);
        return next;
      });
    } finally {
      setLoading(false);
      sendingRef.current = false;
      scrollToBottom();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const exceeded = remaining <= 0;

  return (
    <div className="flex h-[calc(100vh-10rem)] overflow-hidden rounded-xl border bg-white shadow-lg">
      {/* Chat sidebar */}
      <div className="flex w-60 shrink-0 flex-col border-r bg-slate-50/50">
        <div className="flex items-center justify-between px-3 py-3">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Chats</span>
          <button
            onClick={handleNewChat}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition"
            title="New chat"
          >
            +
          </button>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => setActiveChatId(chat.id)}
              className={`group flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm cursor-pointer transition ${
                activeChatId === chat.id
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {editingTitle === chat.id ? (
                <input
                  className="hb-input flex-1 rounded px-1.5 py-0.5 text-xs"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={() => handleRenameChat(chat.id)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") handleRenameChat(chat.id);
                    if (e.key === "Escape") setEditingTitle(null);
                  }}
                  autoFocus
                  maxLength={80}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <span className="flex-1 truncate">{chat.title}</span>
                  <button
                    onClick={(e) => startRename(chat, e)}
                    className="hidden group-hover:flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:text-slate-600"
                    title="Rename"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => handleDeleteChat(chat.id, e)}
                    className="hidden group-hover:flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:text-red-600"
                    title="Delete"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          ))}
          {chats.length === 0 && (
            <p className="px-2.5 py-4 text-xs text-slate-400 text-center">
              No chats yet. Start one!
            </p>
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white text-sm font-bold">
              P
            </div>
            <div>
              <h2 className="hb-card-section text-sm font-semibold">Pip</h2>
              <p className="hb-card-meta text-xs">Homework assistant</p>
            </div>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              remaining <= 5
                ? "bg-red-50 text-red-700"
                : remaining <= 15
                  ? "bg-amber-50 text-amber-700"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {remaining} prompt{remaining !== 1 ? "s" : ""} left
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {messages.map((msg, i) => (
            <div
              key={msg.id ?? i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-800"
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                  </svg>
                  Pip is thinking...
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 border-t px-4 py-3">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={exceeded ? "No prompts left today" : "Ask Pip about your homework..."}
              disabled={loading || exceeded}
              className="hb-input flex-1 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
              maxLength={500}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim() || exceeded}
              className="hb-btn-primary shrink-0 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
            >
              {loading ? "..." : "Send"}
            </button>
          </div>
          <p className="hb-card-meta mt-1.5 text-center text-[10px]">
            Pip knows your homework — subjects, due dates, instructions, and what you've completed. {DAILY_LIMIT} prompts/day.
          </p>
        </div>
      </div>
    </div>
  );
}
