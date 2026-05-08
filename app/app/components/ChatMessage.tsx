"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, User } from "lucide-react";

type Role = "user" | "assistant";

export default function ChatMessage({
  role,
  content,
  stream = false,
  speed = 14,
}: {
  role: Role;
  content: string;
  stream?: boolean;
  speed?: number; // chars per tick
}) {
  const [displayed, setDisplayed] = useState(stream ? "" : content);

  useEffect(() => {
    if (!stream) {
      setDisplayed(content);
      return;
    }
    setDisplayed("");
    let i = 0;
    const handle = window.setInterval(() => {
      i = Math.min(i + speed, content.length);
      setDisplayed(content.slice(0, i));
      if (i >= content.length) window.clearInterval(handle);
    }, 22);
    return () => window.clearInterval(handle);
  }, [content, stream, speed]);

  const isUser = role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}
    >
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
          isUser
            ? "bg-[var(--ss-i-100)] text-[var(--ss-i-600)]"
            : "bg-[var(--ss-o-500)] text-white shadow-[var(--ss-shadow-brand)]"
        }`}
      >
        {isUser ? <User size={13} /> : <Sparkles size={13} />}
      </div>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-[var(--ss-i-900)] text-white rounded-br-md"
            : "bg-white border border-[var(--ss-i-200)] text-[var(--ss-i-700)] rounded-bl-md shadow-[var(--ss-shadow)]"
        }`}
      >
        <MiniMarkdown source={displayed} />
        {stream && displayed.length < content.length && (
          <span className="inline-block w-0.5 h-3.5 ml-0.5 align-baseline bg-current opacity-60 animate-pulse" />
        )}
      </div>
    </motion.div>
  );
}

/** Minimal markdown — bold, inline code, bullet lists, paragraphs. No deps. */
function MiniMarkdown({ source }: { source: string }) {
  const lines = source.split(/\n/);
  const blocks: React.ReactNode[] = [];
  let listBuf: string[] = [];
  const flushList = () => {
    if (listBuf.length === 0) return;
    blocks.push(
      <ul key={blocks.length} className="list-disc ml-5 my-1 space-y-1">
        {listBuf.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    listBuf = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*[-*]\s+/.test(line)) {
      listBuf.push(line.replace(/^\s*[-*]\s+/, ""));
      continue;
    }
    flushList();
    if (line.trim() === "") {
      blocks.push(<div key={blocks.length} className="h-1" />);
    } else {
      blocks.push(
        <p key={blocks.length} className="my-0.5">
          {renderInline(line)}
        </p>
      );
    }
  }
  flushList();
  return <>{blocks}</>;
}

function renderInline(text: string): React.ReactNode[] {
  // bold then code; left to right
  const tokens: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) tokens.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      tokens.push(
        <strong key={m.index} className="font-semibold">
          {tok.slice(2, -2)}
        </strong>
      );
    } else if (tok.startsWith("`")) {
      tokens.push(
        <code
          key={m.index}
          className="px-1 py-0.5 rounded bg-[var(--ss-i-100)] text-[var(--ss-i-700)] text-[12px] font-mono"
        >
          {tok.slice(1, -1)}
        </code>
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) tokens.push(text.slice(last));
  return tokens;
}
