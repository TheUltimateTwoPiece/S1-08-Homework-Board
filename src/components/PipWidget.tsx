"use client";

import { useRef, useState } from "react";
import { askPip, DAILY_LIMIT, type PipResult } from "@/actions/pip";

type Message = {
  role: "user" | "pip";
  text: string;
};

const WELCOME_MESSAGE: Message = {
  role: "pip",
  text: "Hey! I'm Pip, your homework assistant. I can see your assignments, due dates, and progress. Ask me anything — how you're doing, what's overdue, or what to tackle next!",
};

export function PipWidget({ remaining: initialRemaining }: { remaining: number }) {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState(initialRemaining);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function scrollToBottom() {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  async function handleSend() {
    const question = input.trim();
    if (!question || loading || remaining <= 0) return;

    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setLoading(true);
    scrollToBottom();

    try {
      const result: PipResult = await askPip(question);
      if (result.reply) {
        const replyText = result.reply;
        setMessages((prev) => [...prev, { role: "pip", text: replyText }]);
      } else if (result.error) {
        setMessages((prev) => [...prev, { role: "pip", text: `⚠️ ${result.error}` }]);
      }
      if (result.remaining !== undefined) {
        setRemaining(result.remaining);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "pip", text: "Something went wrong. Try again?" }]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] flex-col rounded-xl border bg-white shadow-lg">
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
        <div className="flex items-center gap-2">
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
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {messages.map((msg, i) => (
          <div
            key={i}
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
              <span className="inline-flex gap-1">
                <span className="hb-spinner h-3 w-3" />
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
            placeholder={remaining <= 0 ? "No prompts left today" : "Ask Pip about your homework..."}
            disabled={loading || remaining <= 0}
            className="hb-input flex-1 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
            maxLength={500}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim() || remaining <= 0}
            className="hb-btn-primary shrink-0 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            {loading ? "..." : "Send"}
          </button>
        </div>
        <p className="hb-card-meta mt-1.5 text-center text-[10px]">
          Pip knows your homework — subjects, due dates, and what you've completed. {DAILY_LIMIT} prompts/day.
        </p>
      </div>
    </div>
  );
}


