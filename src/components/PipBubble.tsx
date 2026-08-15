"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createChat } from "@/actions/pip-chats";
import { togglePostComplete } from "@/actions/completions";
import type { PipResult } from "@/lib/pip-types";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

const SUGGESTED_PROMPTS = [
  { label: "Overdue?", prompt: "What assignments are overdue?" },
  { label: "Progress?", prompt: "How am I doing overall?" },
  { label: "What next?", prompt: "What should I work on next?" },
];

const MINIMIZED_HEIGHT = "h-14";
const EXPANDED_HEIGHT = "h-[480px]";

export function PipBubble({ remaining: initialRemaining }: { remaining: number }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "pip"; text: string }[]>(
    [{ role: "pip", text: "Hey! I'm Pip. Need homework help?" }],
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [chatId, setChatId] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Streaming
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const streamAbortRef = useRef<AbortController | null>(null);

  // Confirmation
  const [pendingActions, setPendingActions] = useState<NonNullable<PipResult["confirmActions"]>>([]);
  const [executingAction, setExecutingAction] = useState<string | null>(null);

  // Copy feedback
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); });
  }, []);

  useEffect(() => { if (open) scrollToBottom(); }, [messages.length, open, scrollToBottom]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 200); }, [open]);

  // Escape to close
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === "Escape" && open) setOpen(false); }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  async function handleSend(overrideInput?: string) {
    const question = (overrideInput ?? input).trim();
    if (!question || loading || remaining <= 0 || sendingRef.current) return;
    sendingRef.current = true;

    let cid = chatId;
    if (!cid) {
      const id = await createChat();
      if (!id) { sendingRef.current = false; return; }
      cid = id;
      setChatId(id);
    }

    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setLoading(true);
    setIsStreaming(true);
    setStreamingText("");
    setPendingActions([]);
    scrollToBottom();

    const controller = new AbortController();
    streamAbortRef.current = controller;

    // Local accumulation — React state streamingText is stale in this closure
    const acc = { text: "" };

    try {
      const res = await fetch("/api/pip/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, chatId: cid }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error("Stream failed");

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
                // eslint-disable-next-line react-hooks/immutability
                acc.text += event.text;
                setStreamingText(acc.text);
              } else if (event.type === "done") {
                setMessages((prev) => [...prev, { role: "pip", text: acc.text || "" }]);
                setStreamingText("");
                setIsStreaming(false);
                if (event.remaining !== undefined) setRemaining(event.remaining);
                if (event.confirmActions?.length) setPendingActions(event.confirmActions);
              } else if (event.type === "error") {
                setMessages((prev) => [...prev, { role: "pip", text: `⚠️ ${event.message}` }]);
                setStreamingText("");
                setIsStreaming(false);
                if (event.remaining !== undefined) setRemaining(event.remaining);
                if (event.redirect) { window.location.assign(event.redirect); return; }
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User cancelled — save whatever we got
        if (acc.text) setMessages((prev) => [...prev, { role: "pip", text: acc.text }]);
      }
      else setMessages((prev) => [...prev, { role: "pip", text: "Something went wrong. Try again?" }]);
      setStreamingText("");
      setIsStreaming(false);
    } finally {
      setLoading(false);
      sendingRef.current = false;
      streamAbortRef.current = null;
      scrollToBottom();
    }
  }

  function handleStopStreaming() { streamAbortRef.current?.abort(); }

  async function handleRegenerate() {
    if (loading || isStreaming) return;
    const msgs = [...messages];
    const lastUserIdx = [...msgs].reverse().findIndex((m) => m.role === "user");
    if (lastUserIdx === -1) return;
    const actualIdx = msgs.length - 1 - lastUserIdx;
    // Remove last pip reply
    setMessages((prev) => prev.slice(0, -1));
    setIsStreaming(false);
    setStreamingText("");
    await handleSend(msgs[actualIdx].text);
  }

  function handleCopy(text: string, idx: number) {
    navigator.clipboard.writeText(text).then(() => { setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 1500); }).catch(() => {});
  }

  async function handleConfirmAction(action: NonNullable<PipResult["confirmActions"]>[number]) {
    const key = `${action.type}-${action.params.post_id}`;
    setExecutingAction(key);
    try {
      const formData = new FormData();
      formData.append("postId", action.params.post_id);
      await togglePostComplete(formData);
      setPendingActions((prev) => prev.filter((a) => !(a.type === action.type && a.params.post_id === action.params.post_id)));
      setMessages((prev) => [...prev, { role: "pip", text: action.type === "mark_complete" ? "Post marked as complete \u2705" : "Post unmarked \u21a9" }]);
      scrollToBottom();
    } catch { /* silent */ }
    finally { setExecutingAction(null); }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl border bg-white dark:border-slate-700 dark:bg-slate-900 shadow-2xl transition-all duration-300 ${
      open ? EXPANDED_HEIGHT + " w-[360px] max-sm:w-[calc(100vw-3rem)]" : MINIMIZED_HEIGHT + " w-14"
    }`}>
      {/* Header */}
      <button onClick={() => setOpen((prev) => !prev)}
        className={`flex shrink-0 items-center hover:bg-slate-50 dark:hover:bg-slate-800 transition rounded-t-2xl ${
          open ? "gap-3 px-4 py-3 border-b dark:border-slate-700" : "justify-center px-3 py-3 rounded-b-2xl"
        }`}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white text-xs font-bold">P</div>
        {open && (
          <>
            <span className="flex-1 text-left text-sm font-semibold text-slate-800 dark:text-slate-100">Pip</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              remaining <= 5 ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                : remaining <= 15 ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            }`}>{remaining}</span>
          </>
        )}
      </button>

      {open && (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 dark:bg-slate-900/30">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "pip" ? (
                  <div className="group relative max-w-[88%] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-800 dark:bg-slate-800 px-3 py-2 text-xs">
                    <MarkdownRenderer text={msg.text} />
                    <div className="absolute -bottom-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity translate-y-full pt-1 z-10">
                      <button onClick={() => handleCopy(msg.text, i)}
                        className="flex h-5 w-5 items-center justify-center rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shadow-sm"
                        title="Copy">
                        {copiedIdx === i ? (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-2.5 w-2.5 text-green-500"><polyline points="20 6 9 17 4 12" /></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-2.5 w-2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                        )}
                      </button>
                      {i === messages.length - 1 && msg.role === "pip" && (
                        <button onClick={handleRegenerate}
                          className="flex h-5 w-5 items-center justify-center rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shadow-sm"
                          title="Regenerate">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-2.5 w-2.5"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="max-w-[85%] rounded-xl bg-blue-600 dark:bg-blue-500 px-3 py-2 text-xs text-white">
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                  </div>
                )}
              </div>
            ))}

            {/* Streaming */}
            {isStreaming && (
              <div className="flex justify-start items-end gap-1">
                <div className="max-w-[88%] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-800 dark:bg-slate-800 px-3 py-2 text-xs">
                  {streamingText ? (
                    <MarkdownRenderer text={streamingText} />
                  ) : (
                    <span className="text-slate-300 dark:text-slate-300 italic">Thinking...</span>
                  )}
                  {streamingText && <span className="inline-block w-1 h-3 ml-0.5 bg-blue-500 animate-pulse rounded-sm align-middle" />}
                </div>
                <button onClick={handleStopStreaming}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition mb-1"
                  title="Stop">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-2.5 w-2.5 text-slate-500 dark:text-slate-400"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                </button>
              </div>
            )}

            {/* Suggested prompts */}
            {!loading && !isStreaming && messages.length <= 1 && (
              <div className="pt-2">
                <div className="flex flex-wrap gap-1">
                  {SUGGESTED_PROMPTS.map((sp) => (
                    <button key={sp.label} onClick={() => handleSend(sp.prompt)}
                      className="rounded-full border border-slate-200 dark:border-slate-600 px-2.5 py-1 text-[11px] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-600 transition"
                      disabled={remaining <= 0}>
                      {sp.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Confirmations */}
            {pendingActions.map((action, i) => (
              <div key={`ba-${i}`} className="flex justify-start">
                <div className="max-w-[88%] rounded-xl border-2 border-blue-200 dark:border-blue-700 bg-blue-50/60 dark:bg-blue-900/30 px-3 py-2">
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-1.5">Pip suggests:</p>
                  <button onClick={() => handleConfirmAction(action)} disabled={executingAction !== null}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition">
                    {executingAction === `${action.type}-${action.params.post_id}` ? "Doing..." : action.label}
                  </button>
                </div>
              </div>
            ))}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-900">
            <div className="flex gap-1.5">
              <input ref={inputRef} type="text" value={input}
                onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder={remaining <= 0 ? "Out of prompts" : isStreaming ? "Pip is typing..." : "Ask Pip..."}
                disabled={loading || remaining <= 0}
                className="hb-input flex-1 rounded-lg px-2.5 py-1.5 text-xs disabled:opacity-50" maxLength={500} />
              {isStreaming ? (
                <button onClick={handleStopStreaming}
                  className="rounded-lg bg-slate-200 dark:bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition">Stop</button>
              ) : (
                <button onClick={() => handleSend()}
                  disabled={loading || !input.trim() || remaining <= 0}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40 transition">
                  Send
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
