"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createChat,
  deleteChat,
  renameChat,
  getChats,
  getMessages,
  updateInstructions,
  type PipChat,
} from "@/actions/pip-chats";
import { togglePostComplete } from "@/actions/completions";
import { DAILY_LIMIT, type PipResult } from "@/lib/pip-types";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

const WELCOME_TEXT =
  "Hey! I'm Pip, your homework assistant. I can see your assignments, due dates, and progress. Ask me anything — how you're doing, what's overdue, or what to tackle next!";

const SUGGESTED_PROMPTS = [
  { label: "What's overdue?", prompt: "What assignments are overdue?" },
  { label: "How am I doing?", prompt: "How am I doing overall? Give me a quick summary." },
  { label: "What next?", prompt: "What should I work on next?" },
  { label: "This week", prompt: "Summarize my week — what's due and what have I finished?" },
];

function useIsMac(): boolean {
  const [isMac, setIsMac] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setIsMac(typeof navigator !== "undefined" && navigator.platform.includes("Mac")); }, []);
  return isMac;
}

export function PipWidget({
  remaining: initialRemaining,
  initialChats,
}: {
  remaining: number;
  initialChats: PipChat[];
}) {
  const isMac = useIsMac();
  const [chats, setChats] = useState<PipChat[]>(initialChats);
  const [activeChatId, setActiveChatId] = useState<string | null>(chats[0]?.id ?? null);
  const [messageCache, setMessageCache] = useState<Map<string, { role: "user" | "pip"; text: string; id?: string }[]>>(new Map());
  const messages = activeChatId ? (messageCache.get(activeChatId) ?? []) : [];
  const cacheRef = useRef(messageCache);
  useEffect(() => { cacheRef.current = messageCache; }, [messageCache]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const sendingRef = useRef(false);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Instructions
  const [instructionsInput, setInstructionsInput] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);

  // Streaming state
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const streamAbortRef = useRef<AbortController | null>(null);

  // Confirmation actions
  const [pendingActions, setPendingActions] = useState<{ chatId: string; actions: NonNullable<PipResult["confirmActions"]> }[]>([]);
  const [executingAction, setExecutingAction] = useState<string | null>(null);

  // Mobile sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Chat-specific state
  const activeChat = chats.find((c) => c.id === activeChatId);
  const hasInstructions = !!activeChat?.system_instructions;
  const messagesCount = activeChatId ? (messageCache.get(activeChatId)?.length ?? 0) : 0;
  const isNewEmptyChat = activeChatId && messagesCount <= 1;

  // Copy feedback
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  // Load messages when active chat changes
  useEffect(() => {
    if (!activeChatId) return;
    if (cacheRef.current.has(activeChatId)) return;
    let cancelled = false;
    getMessages(activeChatId).then((msgs) => {
      if (cancelled) return;
      const loaded = msgs.length > 0
        ? msgs.map((m) => ({ role: m.role, text: m.text, id: m.id }))
        : [{ role: "pip" as const, text: WELCOME_TEXT }];
      setMessageCache((prev) => { const next = new Map(prev); next.set(activeChatId, loaded); return next; });
      const chat = chats.find((c) => c.id === activeChatId);
      if (chat?.system_instructions) { setInstructionsInput(chat.system_instructions); setShowInstructions(true); }
      else { setInstructionsInput(""); setShowInstructions(false); }
      requestAnimationFrame(() => { bottomRef.current?.scrollIntoView({ behavior: "instant" as ScrollBehavior }); });
    });
    return () => { cancelled = true; };
  }, [activeChatId, chats]);

  // Keyboard shortcuts
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "k") { e.preventDefault(); inputRef.current?.focus(); }
      if (mod && e.shiftKey && e.key === "N") { e.preventDefault(); handleNewChat(); }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const refreshChats = useCallback(async () => {
    const fresh = await getChats();
    setChats(fresh);
  }, []);

  async function handleSaveInstructions() {
    if (!activeChatId) return;
    await updateInstructions(activeChatId, instructionsInput);
    await refreshChats();
    setShowInstructions(false);
  }

  async function handleNewChat() {
    const id = await createChat();
    if (id) {
      setActiveChatId(id);
      setMessageCache((prev) => { const next = new Map(prev); next.set(id, [{ role: "pip", text: WELCOME_TEXT }]); return next; });
      setInstructionsInput("");
      setShowInstructions(true);
      setInput("");
      setSidebarOpen(false);
      refreshChats().catch(() => {});
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  async function handleDeleteChat(chatId: string, e: React.MouseEvent) {
    e.stopPropagation();
    await deleteChat(chatId);
    await refreshChats();
    setMessageCache((prev) => { const next = new Map(prev); next.delete(chatId); return next; });
    if (activeChatId === chatId) {
      const other = chats.filter((c) => c.id !== chatId);
      setActiveChatId(other[0]?.id ?? null);
    }
  }

  async function handleRenameChat(chatId: string) {
    if (!titleDraft.trim()) { setEditingTitle(null); return; }
    await renameChat(chatId, titleDraft.trim());
    await refreshChats();
    setEditingTitle(null);
  }

  function startRename(chat: PipChat, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingTitle(chat.id);
    setTitleDraft(chat.title);
  }

  // ── Streaming send ──
  async function handleSend(overrideInput?: string) {
    const question = (overrideInput ?? input).trim();
    if (!question || loading || remaining <= 0 || sendingRef.current) return;
    sendingRef.current = true;

    let chatId = activeChatId;
    if (!chatId) {
      const id = await createChat(instructionsInput || undefined);
      if (!id) { sendingRef.current = false; return; }
      chatId = id;
      setActiveChatId(id);
      setMessageCache((prev) => { const next = new Map(prev); next.set(id, [{ role: "pip", text: WELCOME_TEXT }]); return next; });
      await refreshChats();
    }

    // Optimistic user message
    setMessageCache((prev) => {
      const next = new Map(prev);
      const current = next.get(chatId) ?? [];
      next.set(chatId, [...current, { role: "user", text: question }]);
      return next;
    });
    setInput("");
    setLoading(true);
    setShowInstructions(false);
    setIsStreaming(true);
    setStreamingText("");
    scrollToBottom();

    // Clear old pending actions for this chat
    setPendingActions((prev) => prev.filter((p) => p.chatId !== chatId));

    const controller = new AbortController();
    streamAbortRef.current = controller;

    // Use a local variable to accumulate tokens — streamingText from closure
    // is stale because React state updates are async.
    let accumulated = "";

    try {
      const res = await fetch("/api/pip/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          chatId,
          systemInstructions: instructionsInput || undefined,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Stream failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const lines = part.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "token") {
                accumulated += event.text;
                setStreamingText(accumulated);
              } else if (event.type === "done") {
                // Use the local accumulated text — NOT the stale streamingText from closure
                setMessageCache((prev) => {
                  const next = new Map(prev);
                  const current = next.get(chatId) ?? [];
                  next.set(chatId, [...current, { role: "pip", text: accumulated || "" }]);
                  return next;
                });
                setStreamingText("");
                setIsStreaming(false);
                if (event.remaining !== undefined) setRemaining(event.remaining);
                if (event.confirmActions?.length) {
                  setPendingActions((prev) => [...prev, { chatId, actions: event.confirmActions! }]);
                }
                refreshChats().catch(() => {});
              } else if (event.type === "error") {
                setMessageCache((prev) => {
                  const next = new Map(prev);
                  const current = next.get(chatId) ?? [];
                  next.set(chatId, [...current, { role: "pip", text: `\u26a0\ufe0f ${event.message}` }]);
                  return next;
                });
                setStreamingText("");
                setIsStreaming(false);
                if (event.remaining !== undefined) setRemaining(event.remaining);
                if (event.redirect) { window.location.assign(event.redirect); return; }
              }
            } catch { /* skip malformed events */ }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User cancelled — save whatever tokens we got so far
        if (accumulated) {
          setMessageCache((prev) => {
            const next = new Map(prev);
            const current = next.get(chatId) ?? [];
            next.set(chatId, [...current, { role: "pip", text: accumulated }]);
            return next;
          });
        }
      } else {
        setMessageCache((prev) => {
          const next = new Map(prev);
          const current = next.get(chatId) ?? [];
          next.set(chatId, [...current, { role: "pip", text: "Something went wrong. Try again?" }]);
          return next;
        });
      }
      setStreamingText("");
      setIsStreaming(false);
    } finally {
      setLoading(false);
      sendingRef.current = false;
      streamAbortRef.current = null;
      scrollToBottom();
    }
  }

  function handleStopStreaming() {
    streamAbortRef.current?.abort();
  }

  async function handleRegenerate() {
    if (!activeChatId || loading || isStreaming) return;
    const msgs = messageCache.get(activeChatId) ?? [];
    // Find last user message
    const lastUserIdx = [...msgs].reverse().findIndex((m) => m.role === "user");
    if (lastUserIdx === -1) return;
    const actualIdx = msgs.length - 1 - lastUserIdx;
    const lastUserMsg = msgs[actualIdx];
    // Only remove if the last message is a Pip reply (not the user message itself)
    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg?.role === "pip") {
      setMessageCache((prev) => {
        const next = new Map(prev);
        const current = [...(next.get(activeChatId) ?? [])];
        current.pop();
        next.set(activeChatId, current);
        return next;
      });
    }
    setIsStreaming(false);
    setStreamingText("");
    await handleSend(lastUserMsg.text);
  }

  function handleCopy(text: string, idx: number) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    }).catch(() => {});
  }

  async function handleConfirmAction(action: NonNullable<PipResult["confirmActions"]>[number]) {
    const key = `${action.type}-${action.params.post_id}`;
    setExecutingAction(key);
    try {
      const formData = new FormData();
      formData.append("postId", action.params.post_id);
      await togglePostComplete(formData);
      setPendingActions((prev) =>
        prev.map((p) => ({ ...p, actions: p.actions.filter((a) => !(a.type === action.type && a.params.post_id === action.params.post_id)) }))
          .filter((p) => p.actions.length > 0),
      );
      if (activeChatId) {
        setMessageCache((prev) => {
          const next = new Map(prev);
          const current = next.get(activeChatId) ?? [];
          next.set(activeChatId, [...current, { role: "pip", text: action.type === "mark_complete" ? "Post marked as complete \u2705" : "Post unmarked \u21a9" }]);
          return next;
        });
      }
      scrollToBottom();
    } catch { /* silent */ }
    finally { setExecutingAction(null); }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const exceeded = remaining <= 0;
  const activePendingActions = pendingActions.find((p) => p.chatId === activeChatId)?.actions;

  // ── Render ──
  return (
    <div className="flex h-[calc(100vh-10rem)] max-sm:h-[calc(100dvh-3rem)] overflow-hidden rounded-xl border bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
      {/* ── Mobile sidebar overlay ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 sm:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-slate-900 border-r dark:border-slate-700 z-50 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <ChatSidebar
              chats={chats} activeChatId={activeChatId} editingTitle={editingTitle} titleDraft={titleDraft}
              onSelect={(id) => { setActiveChatId(id); setSidebarOpen(false); }}
              onNew={handleNewChat} onDelete={handleDeleteChat}
              onStartRename={startRename} onTitleDraft={setTitleDraft}
              onRename={handleRenameChat} onCancelRename={() => setEditingTitle(null)}
            />
          </div>
        </div>
      )}

      {/* ── Desktop sidebar ── */}
      <div className="hidden sm:flex w-60 shrink-0 flex-col border-r bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900/50">
        <ChatSidebar
          chats={chats} activeChatId={activeChatId} editingTitle={editingTitle} titleDraft={titleDraft}
          onSelect={(id) => setActiveChatId(id)}
          onNew={handleNewChat} onDelete={handleDeleteChat}
          onStartRename={startRename} onTitleDraft={setTitleDraft}
          onRename={handleRenameChat} onCancelRename={() => setEditingTitle(null)}
        />
      </div>

      {/* ── Main chat area ── */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b px-4 sm:px-5 py-3 sm:py-4 dark:border-slate-700">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile hamburger */}
            <button onClick={() => setSidebarOpen(true)} className="sm:hidden flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Chats">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
            </button>
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white text-xs sm:text-sm font-bold">P</div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Pip</h2>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">Homework assistant</p>
            </div>
          </div>
          <span className={`rounded-full px-2 py-0.5 sm:px-2.5 sm:py-0.5 text-[10px] sm:text-xs font-medium ${
            remaining <= 5 ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              : remaining <= 15 ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          }`}>
            {remaining} prompt{remaining !== 1 ? "s" : ""} left
          </span>
        </div>

        {/* Instructions banner */}
        {hasInstructions && !isNewEmptyChat && (
          <div className="shrink-0 border-b bg-blue-50/50 dark:bg-blue-900/20 dark:border-slate-700 px-3 sm:px-5 py-2 sm:py-2.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 dark:text-slate-400">Instructions:</span>
              <span className="font-medium text-blue-700 dark:text-blue-300 truncate max-w-[200px] sm:max-w-[300px]">{activeChat?.system_instructions}</span>
              <button onClick={() => { setInstructionsInput(activeChat?.system_instructions ?? ""); setShowInstructions(true); }}
                className="ml-auto text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 text-[10px] font-medium shrink-0">Edit</button>
            </div>
          </div>
        )}

        {/* Instructions editor */}
        {showInstructions && isNewEmptyChat && (
          <div className="shrink-0 border-b bg-blue-50/30 dark:bg-blue-900/10 dark:border-slate-700 px-3 sm:px-5 py-3">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Tell Pip how to behave (optional)</label>
            <textarea value={instructionsInput} onChange={(e) => setInstructionsInput(e.target.value)}
              placeholder="e.g. 'Act like Mario', 'Be super formal', 'Explain things like I'm 10'"
              className="hb-input w-full rounded-lg px-3 py-2 text-xs resize-none" rows={2} maxLength={300} />
            <div className="mt-2 flex items-center gap-2">
              <button onClick={handleSaveInstructions} className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 transition">
                {instructionsInput.trim() ? "Save & Start" : "Skip"}
              </button>
              <button onClick={() => setShowInstructions(false)} className="rounded-lg px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition">Cancel</button>
              <span className="ml-auto text-[10px] text-slate-400 dark:text-slate-500">You can always change this later</span>
            </div>
          </div>
        )}

        {/* Suggested prompts */}
        {!loading && !isStreaming && messages.length <= 1 && (
          <div className="shrink-0 border-b dark:border-slate-700 px-3 sm:px-5 py-3">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wide">Try asking</p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_PROMPTS.map((sp) => (
                <button key={sp.label} onClick={() => handleSend(sp.prompt)}
                  className="rounded-full border border-slate-200 dark:border-slate-600 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-600 transition"
                  disabled={exceeded}>
                  {sp.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 space-y-4 overflow-y-auto px-3 sm:px-5 py-4 dark:bg-slate-900/30">
          {messages.map((msg, i) => (
            <div key={msg.id ?? i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {/* Pip messages get markdown + hover actions */}
              {msg.role === "pip" ? (
                <div className="group relative max-w-[90%] sm:max-w-[80%] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-800 dark:bg-slate-800 px-3 sm:px-4 py-2.5 text-sm">
                  <MarkdownRenderer text={msg.text} />
                  {/* Hover actions */}
                  <div className="absolute -bottom-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity translate-y-full pt-1">
                    <button onClick={() => handleCopy(msg.text, i)}
                      className="flex h-6 w-6 items-center justify-center rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-[10px] shadow-sm"
                      title="Copy">
                      {copiedIdx === i ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3 text-green-500"><polyline points="20 6 9 17 4 12" /></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                      )}
                    </button>
                    {i === messages.length - 1 && msg.role === "pip" && (
                      <button onClick={handleRegenerate}
                        className="flex h-6 w-6 items-center justify-center rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-[10px] shadow-sm"
                        title="Regenerate">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="max-w-[85%] sm:max-w-[80%] rounded-xl bg-blue-600 dark:bg-blue-500 px-3 sm:px-4 py-2.5 text-sm text-white">
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                </div>
              )}
            </div>
          ))}

          {/* Streaming message */}
          {isStreaming && (
            <div className="flex justify-start">
              <div className="max-w-[90%] sm:max-w-[80%] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-800 dark:bg-slate-800 px-3 sm:px-4 py-2.5 text-sm">
                {streamingText ? (
                  <MarkdownRenderer text={streamingText} />
                ) : (
                  <span className="text-slate-300 dark:text-slate-300 italic">Pip is thinking...</span>
                )}
                {streamingText && <span className="inline-block w-1.5 h-4 ml-0.5 bg-blue-500 animate-pulse rounded-sm align-middle" />}
              </div>
              {/* Stop button */}
              <button onClick={handleStopStreaming}
                className="ml-2 self-end mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition"
                title="Stop generating">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3 text-slate-500 dark:text-slate-400"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
              </button>
            </div>
          )}

          {/* Confirmation cards */}
          {activePendingActions?.map((action, i) => (
            <div key={`action-${i}`} className="flex justify-start">
              <div className="max-w-[85%] sm:max-w-[80%] rounded-xl border-2 border-blue-200 dark:border-blue-700 bg-blue-50/60 dark:bg-blue-900/30 px-3 sm:px-4 py-3">
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Pip suggests:</p>
                <button onClick={() => handleConfirmAction(action)} disabled={executingAction !== null}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition">
                  {executingAction === `${action.type}-${action.params.post_id}` ? "Doing..." : action.label}
                </button>
              </div>
            </div>
          ))}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 border-t dark:border-slate-700 px-3 sm:px-4 py-2 sm:py-3 bg-white dark:bg-slate-900">
          <div className="flex gap-1.5 sm:gap-2">
            <input ref={inputRef} type="text" value={input}
              onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder={exceeded ? "No prompts left today" : isStreaming ? "Pip is typing..." : "Ask Pip about your homework..."}
              disabled={loading || exceeded}
              className="hb-input flex-1 rounded-lg px-2.5 sm:px-3 py-2 text-xs sm:text-sm disabled:opacity-50"
              maxLength={500} />
            {isStreaming ? (
              <button onClick={handleStopStreaming}
                className="shrink-0 rounded-lg bg-slate-200 dark:bg-slate-700 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition">
                Stop
              </button>
            ) : (
              <button onClick={() => handleSend()}
                disabled={loading || !input.trim() || exceeded}
                className="button shrink-0 gap-2">
                Send
              </button>
            )}
          </div>
          <p className="mt-1.5 text-center text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500">
            Pip knows your homework — subjects, due dates, instructions, and what you've completed. {DAILY_LIMIT} prompts/day.{" "}
            <kbd className="hidden sm:inline px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[9px] border dark:border-slate-700">{isMac ? "⌘" : "Ctrl"}K</kbd>{" "}
            <span className="hidden sm:inline">to focus</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar sub-component ──
function ChatSidebar({
  chats, activeChatId, editingTitle, titleDraft,
  onSelect, onNew, onDelete, onStartRename,
  onTitleDraft, onRename, onCancelRename,
}: {
  chats: PipChat[]; activeChatId: string | null; editingTitle: string | null; titleDraft: string;
  onSelect: (id: string) => void; onNew: () => void; onDelete: (id: string, e: React.MouseEvent) => void;
  onStartRename: (chat: PipChat, e: React.MouseEvent) => void;
  onTitleDraft: (v: string) => void; onRename: (id: string) => void; onCancelRename: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between px-3 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Chats</span>
        <button onClick={onNew} className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition" title="New chat (⌘⇧N)">+</button>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        {chats.map((chat) => (
          <div key={chat.id} onClick={() => onSelect(chat.id)}
            className={`group flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm cursor-pointer transition ${
              activeChatId === chat.id
                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}>
            {editingTitle === chat.id ? (
              <input className="hb-input flex-1 rounded px-1.5 py-0.5 text-xs"
                value={titleDraft} onChange={(e) => onTitleDraft(e.target.value)}
                onBlur={() => onRename(chat.id)}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") onRename(chat.id); if (e.key === "Escape") onCancelRename(); }}
                autoFocus maxLength={80} onClick={(e) => e.stopPropagation()} />
            ) : (
              <>
                <span className="flex-1 truncate">{chat.title}</span>
                <button onClick={(e) => onStartRename(chat, e)}
                  className="hidden group-hover:flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                  title="Rename">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                </button>
                <button onClick={(e) => onDelete(chat.id, e)}
                  className="hidden group-hover:flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400"
                  title="Delete">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                </button>
              </>
            )}
          </div>
        ))}
        {chats.length === 0 && (
          <p className="px-2.5 py-4 text-xs text-center text-slate-400 dark:text-slate-500">No chats yet. Start one!</p>
        )}
      </div>
    </>
  );
}
