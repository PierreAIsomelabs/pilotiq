"use client";
import { useState, useRef, useEffect } from "react";
import { renderMarkdown } from "@/lib/markdown";
import type { SessionResult, StoredDocument } from "@/lib/types";

interface Props {
  sessions: SessionResult[];
  documents: StoredDocument[];
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function CoachPanel({ sessions, documents }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const sendMessage = async () => {
    if (!input.trim() || streaming) return;
    const userMsg = input.trim();
    setInput("");

    const newMessages: Message[] = [...messages, { role: "user", content: userMsg }];
    setMessages([...newMessages, { role: "assistant", content: "" }]);
    setStreaming(true);

    try {
      const res = await fetch("/api/coach-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          history: messages,
          sessions,
          documentTitles: documents.map(d => d.name),
        }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value);
        setMessages([...newMessages, { role: "assistant", content: assistantText }]);
      }
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Erreur de connexion. Réessaye." }]);
    }
    setStreaming(false);
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-30 w-12 h-12 rounded-full bg-[#00e5c8] hover:bg-[#00e5c8]/90 flex items-center justify-center shadow-lg shadow-[#00e5c8]/20 transition-all hover:scale-105"
        >
          <svg className="w-5 h-5 text-[#08090d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-0 right-0 z-30 w-full max-w-[480px] h-[420px] bg-[#0a0d12] border-t border-l border-[#00e5c8]/15 rounded-tl-lg flex flex-col shadow-2xl shadow-black/50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#00e5c8]/8">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00e5c8] animate-pulse"></span>
              <span className="font-display text-sm text-white">Coach <span className="text-[#00e5c8] italic">IA</span></span>
            </div>
            <button onClick={() => setOpen(false)} className="text-[#4a5568] hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-8 space-y-2">
                <p className="text-[#4a5568] text-sm">Pose-moi une question sur ta formation ATPL.</p>
                <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                  {["Que dois-je réviser ?", "Explique le 1-in-60 rule", "Suis-je prêt pour l'examen ?"].map(q => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); }}
                      className="px-2.5 py-1 rounded border border-[#1a2332] text-[#4a5568] font-label text-[0.65rem] hover:border-[#00e5c8]/30 hover:text-[#e8edf5] transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-[#00e5c8]/10 text-[#e8edf5]"
                    : "bg-[#0d1117] border border-[#1a2332] text-[#e8edf5]"
                }`}>
                  {msg.role === "assistant" ? (
                    <div className="prose-cockpit text-sm [&_p]:text-sm [&_p]:mb-1 [&_li]:text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content || "...") }} />
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-[#00e5c8]/8">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Pose ta question..."
                className="flex-1 bg-[#0d1117] border border-[#1a2332] rounded px-3 py-2 text-sm text-white placeholder-[#4a5568] focus:border-[#00e5c8]/30 focus:outline-none font-light"
              />
              <button
                onClick={sendMessage}
                disabled={streaming || !input.trim()}
                className="px-3 py-2 rounded bg-[#00e5c8] text-[#08090d] font-label text-xs font-medium hover:bg-[#00e5c8]/90 transition-colors disabled:opacity-40 shrink-0"
              >
                {streaming ? "..." : "Envoyer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
