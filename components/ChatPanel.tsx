"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Loader2, Copy } from "lucide-react";
import { chatWithAuditor } from "@/app/actions/ai";
import { toast } from "sonner";

interface ChatPanelProps {
  submissionId: string;
  flags: string[];
}

export function ChatPanel({ submissionId, flags }: ChatPanelProps) {
  const [messages, setMessages] = useState<{ role: "user" | "model"; text: string }[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isTyping) return;
    setChatError(null);
    const newMsg = { role: "user" as const, text: textToSend };
    setMessages((prev) => [...prev, newMsg]);
    setInputValue("");
    setIsTyping(true);

    try {
      const res = await chatWithAuditor(submissionId, messages, textToSend);
      if (res.success && res.reply) {
        setMessages((prev) => [...prev, { role: "model", text: res.reply }]);
      } else {
        setChatError(res.error || "Failed to generate reply. Please try again.");
      }
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsTyping(false);
    }
  };

  const renderMessageText = (text: string) => {
    return text.split("\n").map((line, idx) => {
      let content: React.ReactNode = line;
      const isBullet = line.startsWith("* ") || line.startsWith("- ");
      const cleanLine = isBullet ? line.substring(2) : line;

      const boldParts = cleanLine.split(/\*\*(.*?)\*\*/g);
      if (boldParts.length > 1) {
        content = boldParts.map((part, pIdx) => {
          return pIdx % 2 === 1 ? (
            <strong key={pIdx} className="font-semibold text-slate-900">
              {part}
            </strong>
          ) : (
            part
          );
        });
      }

      if (isBullet) {
        return (
          <div key={idx} className="flex gap-1.5 ml-2 my-1">
            <span className="text-slate-900 font-bold">•</span>
            <span>{content}</span>
          </div>
        );
      }

      return <p key={idx} className="my-1">{content}</p>;
    });
  };

  return (
    <div className="border-t border-slate-100 pt-6 mt-6 space-y-4 font-sans">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-slate-100 text-slate-800 rounded-lg">
          <Sparkles size={16} />
        </div>
        <div>
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Pedagogical Chat Assistant</h4>
          <p className="text-[11px] text-slate-500">
            Ask clarifying questions on how to address compliance flags or differentiate activities
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 min-h-[140px] max-h-[300px] overflow-y-auto border border-slate-200/80 rounded-2xl p-4 bg-slate-50/40">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center h-full py-4 space-y-3">
            <p className="text-xs text-slate-400 max-w-xs">
              Select a quick prompt below or type a question to get targeted Cambridge teaching advice.
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {flags.length > 0 ? (
                flags.slice(0, 2).map((flag, fIdx) => (
                  <button
                    key={fIdx}
                    onClick={() =>
                      handleSendMessage(`How specifically can I resolve this compliance flag: "${flag}"?`)
                    }
                    className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-800 text-[11px] font-medium rounded-lg border border-rose-200/70 shadow-2xs text-left max-w-full truncate cursor-pointer"
                  >
                    Resolve: {flag.length > 40 ? flag.substring(0, 38) + "…" : flag}
                  </button>
                ))
              ) : (
                <button
                  onClick={() =>
                    handleSendMessage(
                      "What advanced active-learning strategies can I introduce to make this lesson exemplary?"
                    )
                  }
                  className="px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 text-[11px] font-medium rounded-lg border border-emerald-200/70 shadow-2xs cursor-pointer"
                >
                  How can I elevate this lesson plan further?
                </button>
              )}

              <button
                onClick={() =>
                  handleSendMessage("Suggest 3 active inquiry starter activities for this lesson topic.")
                }
                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-medium rounded-lg border border-slate-200 shadow-2xs cursor-pointer"
              >
                Suggest active inquiry starter activities
              </button>

              <button
                onClick={() =>
                  handleSendMessage("How can I increase the percentage of high-evaluation cognitive tasks?")
                }
                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-medium rounded-lg border border-slate-200 shadow-2xs cursor-pointer"
              >
                Boost high cognitive demand (Bloom's)
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col max-w-[85%] rounded-2xl p-3.5 text-xs shadow-2xs ${
                  msg.role === "user"
                    ? "bg-slate-900 text-white font-normal self-end rounded-tr-xs"
                    : "bg-white border border-slate-200/80 text-slate-800 self-start rounded-tl-xs leading-relaxed"
                }`}
              >
                {msg.role === "user" ? (
                  <p>{msg.text}</p>
                ) : (
                  <>
                    <div className="space-y-1">{renderMessageText(msg.text)}</div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(msg.text);
                        toast.success("Advice copied to clipboard!");
                      }}
                      className="mt-2.5 flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-slate-900 font-semibold cursor-pointer border-t border-slate-100 pt-1.5 w-fit"
                    >
                      <Copy size={11} /> Copy advice
                    </button>
                  </>
                )}
              </div>
            ))}
            {isTyping && (
              <div className="bg-white border border-slate-200/80 rounded-2xl rounded-tl-xs p-3 self-start max-w-[85%] text-slate-500 flex items-center gap-2 text-xs font-medium shadow-2xs">
                <Loader2 className="animate-spin text-slate-700" size={13} />
                Auditor is formulating pedagogical advice…
              </div>
            )}
            {chatError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-2.5 text-xs font-medium self-center max-w-[90%] text-center">
                {chatError}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage(inputValue);
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask how to improve this lesson plan…"
          disabled={isTyping}
          className="flex-1 px-3.5 py-2 border border-slate-200 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none text-xs font-medium rounded-xl bg-white disabled:bg-slate-50"
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || isTyping}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all focus-visible:ring-2 focus-visible:ring-slate-900/20 active:scale-[0.99]"
        >
          <Send size={12} /> Send
        </button>
      </form>
    </div>
  );
}
