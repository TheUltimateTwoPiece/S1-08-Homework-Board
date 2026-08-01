"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { askPip } from "@/actions/pip";
import { createChat } from "@/actions/pip-chats";
import { togglePostComplete } from "@/actions/completions";
import type { PipResult } from "@/lib/pip-types";

const MINIMIZED_HEIGHT = "h-14";
const EXPANDED_HEIGHT = "h-[420px]";

export function PipBubble({
  remaining: initialRemaining,
}: {
  remaining: number;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<
    { role: "user" | "pip"; text: string }[]
  >([{ role: "pip", text: "Hey! I'm Pip. Need homework help?" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [chatId, setChatId] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Confirmation
  const [pendingActions, setPendingActions] = useState<
    NonNullable<PipResult["confirmActions"]>
  >([]);
  const [executingAction, setExecutingAction] = useState<string | null>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  // Auto-scroll when messages change
  useEffect(() => {
    if (open) scrollToBottom();
  }, [messages.length, open, scrollToBottom]);

  // Focus input when opening
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  async function handleSend() {
    const question = input.trim();
    if (!question || loading || remaining <= 0 || sendingRef.current) return;
    sendingRef.current = true;

    // Auto-create chat on first message
    let cid = chatId;
    if (!cid) {
      const id = await createChat();
      if (!id) {
        sendingRef.current = false;
        return;
      }
      cid = id;
      setChatId(id);
    }

    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setLoading(true);
    scrollToBottom();

    try {
      const result: PipResult = await askPip(question, cid);
      if (result.reply) {
        const replyText = result.reply;
        setMessages((prev) => [
          ...prev,
          { role: "pip", text: replyText },
        ]);
      } else if (result.error) {
        setMessages((prev) => [
          ...prev,
          { role: "pip", text: `\u26a0\ufe0f ${result.error}` },
        ]);
      }
      if (result.confirmActions && result.confirmActions.length > 0) {
        setPendingActions(result.confirmActions);
      }
      if (result.remaining !== undefined) setRemaining(result.remaining);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "pip", text: "Something went wrong. Try again?" },
      ]);
    } finally {
      setLoading(false);
      sendingRef.current = false;
      scrollToBottom();
    }
  }

  async function handleConfirmAction(
    action: NonNullable<PipResult["confirmActions"]>[number],
  ) {
    const key = `${action.type}-${action.params.post_id}`;
    setExecutingAction(key);

    try {
      const formData = new FormData();
      formData.append("postId", action.params.post_id);
      await togglePostComplete(formData);

      setPendingActions((prev) =>
        prev.filter(
          (a) =>
            !(
              a.type === action.type &&
              a.params.post_id === action.params.post_id
            ),
        ),
      );

      setMessages((prev) => [
        ...prev,
        {
          role: "pip",
          text:
            action.type === "mark_complete"
              ? "Post marked as complete \u2705"
              : "Post unmarked \u21a9",
        },
      ]);

      scrollToBottom();
    } catch {
      // Silently fail
    } finally {
      setExecutingAction(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl border bg-white shadow-2xl transition-all duration-300 ${
        open
          ? EXPANDED_HEIGHT + " w-80"
          : MINIMIZED_HEIGHT + " w-14"
      }`}
    >
      {/* Header / toggle */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={`flex shrink-0 items-center gap-3 px-4 py-3 hover:bg-slate-50 transition rounded-t-2xl ${
          open ? "border-b" : "rounded-b-2xl"
        }`}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white text-xs font-bold">
          P
        </div>
        {open && (
          <>
            <span className="flex-1 text-left text-sm font-semibold text-slate-800">
              Pip
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                remaining <= 5
                  ? "bg-red-50 text-red-700"
                  : remaining <= 15
                    ? "bg-amber-50 text-amber-700"
                    : "bg-slate-100 text-slate-500"
              }`}
            >
              {remaining}
            </span>
          </>
        )}
      </button>

      {/* Chat body */}
      {open && (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                </div>
              </div>
            ))}

            {/* Confirmation action cards */}
            {pendingActions.map((action, i) => (
              <div key={`bubble-action-${i}`} className="flex justify-start">
                <div className="max-w-[85%] rounded-xl border-2 border-blue-200 bg-blue-50/60 px-3 py-2">
                  <p className="text-[11px] text-slate-500 mb-1.5">
                    Pip suggests:
                  </p>
                  <button
                    onClick={() => handleConfirmAction(action)}
                    disabled={executingAction !== null}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {executingAction ===
                    `${action.type}-${action.params.post_id}`
                      ? "Doing..."
                      : action.label}
                  </button>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-400 italic">
                  Thinking...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t px-3 py-2">
            <div className="flex gap-1.5">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  remaining <= 0 ? "Out of prompts" : "Ask Pip..."
                }
                disabled={loading || remaining <= 0}
                className="hb-input flex-1 rounded-lg px-2.5 py-1.5 text-xs disabled:opacity-50"
                maxLength={500}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim() || remaining <= 0}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40 transition"
              >
                {loading ? "..." : "Send"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
