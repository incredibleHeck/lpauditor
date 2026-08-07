"use client";

import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Loader2, Copy } from "lucide-react";
import { chatWithAuditor } from "@/app/actions/ai";
import { auth } from "@/lib/firebase";
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
            <strong key={pIdx} className="font-extrabold text-zinc-950">
              {part}
            </strong>
          ) : (
            part
          );
        });
      }

      if (isBullet) {
        return (
          <div key={idx} className="flex gap-1.5 ml-2 my-0.5">
            <span className="text-amber-500 font-bold">•</span>
            <span>{content}</span>
          </div>
        );
      }

      return <p key={idx} className="my-0.5">{content}</p>;
    });
  };

  return (
    <div className="border-t border-zinc-100 pt-6 mt-6 space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-600">
          <Sparkles size={16} />
        </div>
        <div>
          <h4 className="text-sm font-bold text-zinc-900">Pedagogical Chat Assistant</h4>
          <p className="text-xs text-zinc-500">
            Ask how to improve activities, fix flags, or differentiate instruction
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 min-h-[140px] max-h-[280px] overflow-y-auto border border-zinc-200 rounded-xl p-4 bg-zinc-50/30">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center h-full py-4 space-y-3">
            <p className="text-xs text-zinc-400 font-medium max-w-[320px]">
              Select a targeted quick prompt based on your audit results or ask any question.
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-[500px]">
              {flags.length > 0 ? (
                flags.slice(0, 2).map((flag, fIdx) => (
                  <button
                    key={fIdx}
                    onClick={() =>
                      handleSendMessage(`How specifically can I fix this compliance flag: "${flag}"?`)
                    }
                    className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg border border-red-200 shadow-xs text-left max-w-full truncate"
                  >
                    ⚠️ Fix: {flag.length > 40 ? flag.substring(0, 37) + "..." : flag}
                  </button>
                ))
              ) : (
                <button
                  onClick={() =>
                    handleSendMessage(
                      "What advanced Cambridge activities can I introduce to make this plan exemplary?"
                    )
                  }
                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg border border-emerald-200 shadow-xs"
                >
                  🌟 How to make this plan exemplary?
                </button>
              )}

              <button
                onClick={() =>
                  handleSendMessage("Suggest 3 active inquiry starter activities for this lesson topic.")
                }
                className="px-2.5 py-1.5 bg-white hover:bg-zinc-100 text-zinc-700 text-xs font-semibold rounded-lg border border-zinc-200 shadow-xs"
              >
                💡 Suggest active inquiry starters
              </button>

              <button
                onClick={() =>
                  handleSendMessage("How can I increase the percentage of high-evaluation cognitive tasks?")
                }
                className="px-2.5 py-1.5 bg-white hover:bg-zinc-100 text-zinc-700 text-xs font-semibold rounded-lg border border-zinc-200 shadow-xs"
              >
                🧠 Boost high cognitive demand
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col max-w-[88%] rounded-2xl p-3 text-sm shadow-xs ${
                  msg.role === "user"
                    ? "bg-amber-600 text-white font-medium self-end rounded-tr-none"
                    : "bg-white border border-zinc-200 text-zinc-800 self-start rounded-tl-none leading-relaxed"
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
                      className="mt-2.5 flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-amber-600 font-semibold cursor-pointer border-t border-zinc-100 pt-1.5 w-fit"
                    >
                      <Copy size={12} /> Copy advice
                    </button>
                  </>
                )}
              </div>
            ))}
            {isTyping && (
              <div className="bg-zinc-100 border border-zinc-200/60 rounded-2xl rounded-tl-none p-3 self-start max-w-[85%] text-zinc-500 flex items-center gap-2 text-xs font-medium animate-pulse shadow-xs">
                <Loader2 className="animate-spin text-amber-600" size={14} />
                Auditor is thinking...
              </div>
            )}
            {chatError && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-2.5 text-xs font-medium self-center max-w-[90%] text-center">
                ⚠️ {chatError}
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
          placeholder="Ask about improving this plan..."
          disabled={isTyping}
          className="flex-1 px-3.5 py-2 border border-zinc-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-sm font-medium rounded-xl disabled:bg-zinc-50"
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || isTyping}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
        >
          <Send size={12} /> Send
        </button>
      </form>
    </div>
  );
}
