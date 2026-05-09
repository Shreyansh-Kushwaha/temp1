"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, X, Send, Loader2, ChevronDown, ChevronUp,
  TrendingUp, Target, Users, AlertCircle, BookOpen, Award,
  MessageSquare, Calendar, BarChart3, Lightbulb, Heart, BookmarkPlus,
} from "lucide-react";
import { api } from "@/app/lib/api";
import ChatMessage from "@/app/components/ChatMessage";
import SuggestedPromptChips from "@/app/components/SuggestedPromptChips";
import {
  QUICK_PROMPTS,
  PROMPT_CATEGORIES,
  type PromptCategory,
} from "@/app/lib/copilot-prompts";

interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  stream?: boolean;
}

const CATEGORY_ICONS: Record<PromptCategory["icon"], typeof Sparkles> = {
  TrendingUp, Sparkles, Target, Users, AlertCircle, BookOpen,
  Award, MessageSquare, Calendar, BarChart3, Lightbulb, Heart,
};

export default function CopilotPanel({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [prompts, setPrompts] = useState<string[]>(QUICK_PROMPTS);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setError(null);
    const userMsg: UIMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setSending(true);
    try {
      const res = await api.copilot.send({
        student_id: studentId,
        message: trimmed,
        conversation_id: conversationId,
      });
      setConversationId(res.conversation_id);
      if (res.suggested_prompts?.length) setPrompts(res.suggested_prompts);
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: res.reply,
          stream: true,
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Copilot failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Floating launcher */}
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full bg-[var(--ss-i-900)] text-white shadow-[0_12px_32px_rgba(15,17,21,.18)] hover:bg-black"
        aria-label="Open AI Copilot"
        style={{ display: open ? "none" : "inline-flex" }}
      >
        <span className="w-7 h-7 rounded-full bg-[var(--ss-o-500)] flex items-center justify-center">
          <Sparkles size={13} />
        </span>
        <span className="text-sm font-semibold" style={{ fontFamily: "var(--font-jakarta)" }}>
          PTM Copilot
        </span>
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-6 right-6 z-50 w-[min(420px,calc(100vw-2rem))] h-[min(620px,calc(100vh-3rem))] bg-white rounded-3xl border border-[var(--ss-i-200)] shadow-[0_24px_64px_rgba(15,17,21,.18)] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-[var(--ss-i-100)] bg-gradient-to-r from-[var(--ss-i-900)] to-[#1F232E] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-[var(--ss-o-500)] flex items-center justify-center shadow-[var(--ss-shadow-brand)]">
                  <Sparkles size={13} />
                </span>
                <div>
                  <p className="text-sm font-bold" style={{ fontFamily: "var(--font-jakarta)" }}>
                    PTM Copilot
                  </p>
                  <p className="text-[10px] text-white/60">
                    Context: {studentName ?? studentId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                aria-label="Close"
                type="button"
              >
                <X size={15} />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
              style={{ background: "var(--ss-bg)" }}
            >
              {messages.length === 0 && (
                <div className="py-4">
                  <p className="text-xs text-[var(--ss-i-400)] mb-3 leading-relaxed">
                    Ask anything about{" "}
                    <span className="font-semibold text-[var(--ss-i-700)]">
                      {studentName ?? "this student"}
                    </span>
                    . The copilot uses the latest report as grounding.
                  </p>
                  <SuggestedPromptChips prompts={prompts} onPick={(p) => void send(p)} />

                  {/* Browse-all-questions expandable */}
                  <button
                    type="button"
                    onClick={() => setBrowseOpen((v) => !v)}
                    className="mt-4 w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-[var(--ss-i-200)] hover:border-[var(--ss-o-300)] transition-colors text-xs font-semibold text-[var(--ss-i-700)]"
                  >
                    <span className="flex items-center gap-1.5">
                      <BookmarkPlus size={12} className="text-[var(--ss-o-500)]" />
                      Browse all questions
                      <span className="text-[10px] font-normal text-[var(--ss-i-400)] ml-1">
                        {PROMPT_CATEGORIES.reduce((n, c) => n + c.prompts.length, 0)} ideas across {PROMPT_CATEGORIES.length} topics
                      </span>
                    </span>
                    {browseOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>

                  <AnimatePresence initial={false}>
                    {browseOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden mt-2"
                      >
                        <div className="space-y-1.5">
                          {PROMPT_CATEGORIES.map((cat) => {
                            const Icon = CATEGORY_ICONS[cat.icon];
                            const expanded = openCategory === cat.id;
                            return (
                              <div
                                key={cat.id}
                                className="rounded-xl border border-[var(--ss-i-200)] bg-white overflow-hidden"
                              >
                                <button
                                  type="button"
                                  onClick={() => setOpenCategory(expanded ? null : cat.id)}
                                  className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-[var(--ss-o-50)] transition-colors"
                                >
                                  <span className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-md bg-[var(--ss-o-50)] flex items-center justify-center">
                                      <Icon size={11} className="text-[var(--ss-o-600)]" />
                                    </span>
                                    <span className="text-[11px] font-semibold text-[var(--ss-i-800)]">
                                      {cat.label}
                                    </span>
                                    <span className="text-[10px] text-[var(--ss-i-400)] font-normal">
                                      {cat.prompts.length}
                                    </span>
                                  </span>
                                  {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                </button>
                                <AnimatePresence initial={false}>
                                  {expanded && (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: "auto" }}
                                      exit={{ opacity: 0, height: 0 }}
                                      transition={{ duration: 0.15 }}
                                      className="overflow-hidden border-t border-[var(--ss-i-100)] bg-[var(--ss-bg)]"
                                    >
                                      <ul className="py-1.5">
                                        {cat.prompts.map((p) => (
                                          <li key={p}>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setBrowseOpen(false);
                                                setOpenCategory(null);
                                                void send(p);
                                              }}
                                              className="w-full text-left px-3 py-1.5 text-[11px] text-[var(--ss-i-700)] hover:bg-white hover:text-[var(--ss-o-700)] transition-colors leading-snug"
                                            >
                                              <span className="text-[var(--ss-o-500)] mr-1.5">›</span>
                                              {p}
                                            </button>
                                          </li>
                                        ))}
                                      </ul>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
              {messages.map((m) => (
                <ChatMessage key={m.id} role={m.role} content={m.content} stream={m.stream} />
              ))}
              {sending && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[var(--ss-o-500)] text-white flex items-center justify-center shrink-0">
                    <Sparkles size={13} />
                  </div>
                  <div className="bg-white border border-[var(--ss-i-200)] rounded-2xl rounded-bl-md px-4 py-3 shadow-[var(--ss-shadow)]">
                    <TypingDots />
                  </div>
                </div>
              )}
              {error && (
                <p className="text-[11px] text-red-600 px-1">{error}</p>
              )}
            </div>

            {/* Suggestions strip (when there ARE messages) */}
            {messages.length > 0 && !sending && (
              <div className="px-4 pb-2">
                <SuggestedPromptChips
                  prompts={prompts.slice(0, 3)}
                  onPick={(p) => void send(p)}
                  disabled={sending}
                />
              </div>
            )}

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
              className="p-3 border-t border-[var(--ss-i-100)] bg-white"
            >
              <div className="relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send(input);
                    }
                  }}
                  rows={2}
                  placeholder="Ask about progress, strengths, weak areas…"
                  className="w-full resize-none px-3.5 py-2.5 pr-11 rounded-2xl border border-[var(--ss-i-200)] bg-white text-sm text-[var(--ss-i-700)] placeholder:text-[var(--ss-i-400)] focus:outline-none focus:ring-2 focus:ring-[var(--ss-o-300)] focus:border-[var(--ss-o-400)] transition leading-relaxed"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  className="absolute right-2 bottom-2 w-8 h-8 rounded-full bg-[var(--ss-o-500)] text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--ss-o-600)] transition-colors shadow-[var(--ss-shadow-brand)]"
                  aria-label="Send"
                >
                  {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                </button>
              </div>
              <p className="text-[10px] text-[var(--ss-i-400)] mt-1.5 px-1">
                Enter to send · Shift+Enter for newline
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ y: [0, -3, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
          className="w-1.5 h-1.5 rounded-full bg-[var(--ss-i-400)]"
        />
      ))}
    </div>
  );
}
