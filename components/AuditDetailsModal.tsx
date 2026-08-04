"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, CheckCircle, AlertTriangle, Info, BookOpen, Sparkles, Send, Loader2 } from "lucide-react";
import { chatWithAuditor } from "@/app/actions/submissions";

interface Audit {
  id: string;
  submission_id: string;
  score: number | null;
  lessons_detected: number | null;
  strengths: string[]; // string[] stored in JSONB
  flags: string[]; // string[] stored in JSONB
  raw_response: Record<string, unknown>; // Full JSON including summary
  created_at: string;
}

interface AuditDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  audit: Audit | null;
  fileName: string;
}

export default function AuditDetailsModal({ isOpen, onClose, audit, fileName }: AuditDetailsModalProps) {
  const [messages, setMessages] = useState<{ role: "user" | "model"; text: string }[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  
  // Reset chat when modal is opened for a different audit
  const [prevAuditId, setPrevAuditId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  if (!isOpen || !audit) return null;

  if (audit.id !== prevAuditId) {
    setPrevAuditId(audit.id);
    setMessages([]);
    setInputValue("");
    setChatError(null);
    setIsTyping(false);
  }

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isTyping) return;
    setChatError(null);
    const newMsg = { role: "user" as const, text: textToSend };
    setMessages((prev) => [...prev, newMsg]);
    setInputValue("");
    setIsTyping(true);

    try {
      const res = await chatWithAuditor(audit.submission_id, messages, textToSend);
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
          return pIdx % 2 === 1 ? <strong key={pIdx} className="font-extrabold text-zinc-950">{part}</strong> : part;
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

  const score = audit.score || 0;
  const lessons = audit.lessons_detected || 0;
  const strengths: string[] = Array.isArray(audit.strengths) ? audit.strengths : [];
  const flags: string[] = Array.isArray(audit.flags) ? audit.flags : [];
  
  // Extract summary from raw_response or default to a generic text
  const summary = String(audit.raw_response?.summary || 
                  (typeof audit.raw_response === "object" && audit.raw_response !== null ? audit.raw_response.summary : "") || 
                  "Evaluation complete. Feedback summary generated successfully.");

  // Score color classes
  let scoreBg = "bg-red-500/10 border-red-500/20 text-red-500";
  let scoreStroke = "stroke-red-500";
  if (score >= 80) {
    scoreBg = "bg-emerald-500/10 border-emerald-500/20 text-emerald-500";
    scoreStroke = "stroke-emerald-500";
  } else if (score >= 50) {
    scoreBg = "bg-amber-500/10 border-amber-500/20 text-amber-500";
    scoreStroke = "stroke-amber-500";
  }

  // SVG calculations for circle progress
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="relative w-full max-w-2xl bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-600">
              <BookOpen size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 truncate max-w-[320px] sm:max-w-md">
                Audit: {fileName}
              </h2>
              <p className="text-xs text-zinc-500">Pedagogical Compliance Review</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Score & Lessons Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center bg-zinc-50/40 p-5 rounded-xl border border-zinc-100">
            
            {/* Visual Circular Progress Gauge */}
            <div className="flex flex-col items-center justify-center text-center">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  {/* Track circle */}
                  <circle
                    cx="56"
                    cy="56"
                    r={radius}
                    className="stroke-zinc-100"
                    strokeWidth="10"
                    fill="transparent"
                  />
                  {/* Progress circle */}
                  <circle
                    cx="56"
                    cy="56"
                    r={radius}
                    className={`${scoreStroke} transition-all duration-1000 ease-out`}
                    strokeWidth="10"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-2xl font-extrabold text-zinc-900">{score}</span>
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Score</span>
                </div>
              </div>
            </div>

            {/* Score label text & segments info */}
            <div className="sm:col-span-2 space-y-3">
              <div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${scoreBg}`}>
                  {score >= 80 ? "Highly Compliant" : score >= 50 ? "Partially Compliant" : "Critical Actions Needed"}
                </span>
                <h3 className="text-lg font-bold text-zinc-900 mt-2">Evaluation Metrics</h3>
              </div>
              <div className="flex items-center gap-4 py-2 border-t border-zinc-100">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-500">Segments Audited:</span>
                  <span className="px-2 py-0.5 bg-zinc-100 border border-zinc-200 text-zinc-800 text-xs font-bold rounded">
                    {lessons} Lessons
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Executive Summary */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-zinc-800 flex items-center gap-1.5">
              <Info size={16} className="text-zinc-400" />
              Executive Summary
            </h4>
            <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-100 text-sm text-zinc-600 leading-relaxed font-normal">
              {summary}
            </div>
          </div>

          {/* Strengths & Flags Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Strengths (Left Column) */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-zinc-800 flex items-center gap-1.5">
                <CheckCircle size={16} className="text-emerald-500" />
                Pedagogical Strengths
              </h4>
              {strengths.length > 0 ? (
                <ul className="space-y-2.5">
                  {strengths.map((strength, idx) => (
                    <li key={idx} className="flex gap-2 text-sm text-zinc-600 bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-lg">
                      <span className="text-emerald-600 font-bold mt-0.5 select-none">•</span>
                      <p>{strength}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-zinc-400 italic">No specific pedagogical strengths noted in audit.</p>
              )}
            </div>

            {/* Flags (Right Column) */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-zinc-800 flex items-center gap-1.5">
                <AlertTriangle size={16} className="text-red-500" />
                Compliance Flags
              </h4>
              {flags.length > 0 ? (
                <ul className="space-y-2.5">
                  {flags.map((flag, idx) => (
                    <li key={idx} className="flex gap-2 text-sm text-zinc-600 bg-red-500/5 border border-red-500/10 p-3 rounded-lg">
                      <span className="text-red-500 font-bold mt-0.5 select-none">•</span>
                      <p>{flag}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex items-center justify-center p-4 bg-emerald-50/50 border border-emerald-200/50 text-emerald-800 text-xs font-semibold rounded-lg">
                  🎉 Absolutely zero compliance failures detected.
                </div>
              )}
            </div>

          </div>

          {/* Chat Section */}
          <div className="border-t border-zinc-100 pt-6 mt-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-600">
                <Sparkles size={16} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-zinc-900">Pedagogical Chat Assistant</h4>
                <p className="text-xs text-zinc-500">Ask how to improve activities, fix flags, or differentiate instruction</p>
              </div>
            </div>

            {/* Message Pane */}
            <div className="flex flex-col gap-3 min-h-[120px] max-h-[260px] overflow-y-auto border border-zinc-200 rounded-xl p-4 bg-zinc-50/30">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center h-full py-4 space-y-3">
                  <p className="text-xs text-zinc-400 font-medium max-w-[280px]">
                    No messages yet. Select a quick action below or type a message to start improving your lesson plan.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 max-w-[420px]">
                    <button
                      onClick={() => handleSendMessage("How can I resolve the compliance flags?")}
                      className="px-2.5 py-1.5 bg-white hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950 text-xs font-semibold rounded-lg border border-zinc-200 transition-all cursor-pointer shadow-sm"
                    >
                      💡 How do I fix the flags?
                    </button>
                    <button
                      onClick={() => handleSendMessage("Draft a collaborative group activity for this plan.")}
                      className="px-2.5 py-1.5 bg-white hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950 text-xs font-semibold rounded-lg border border-zinc-200 transition-all cursor-pointer shadow-sm"
                    >
                      🤝 Create a group activity
                    </button>
                    <button
                      onClick={() => handleSendMessage("Suggest differentiation strategies for lower-performing students.")}
                      className="px-2.5 py-1.5 bg-white hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950 text-xs font-semibold rounded-lg border border-zinc-200 transition-all cursor-pointer shadow-sm"
                    >
                      📈 Differentiate instruction
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col max-w-[85%] rounded-2xl p-3 text-sm shadow-sm ${
                        msg.role === "user"
                          ? "bg-amber-600 text-white font-medium self-end rounded-tr-none"
                          : "bg-white border border-zinc-200 text-zinc-800 self-start rounded-tl-none leading-relaxed"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <p>{msg.text}</p>
                      ) : (
                        <div className="space-y-1">{renderMessageText(msg.text)}</div>
                      )}
                    </div>
                  ))}
                  {isTyping && (
                    <div className="bg-zinc-100 border border-zinc-200/60 rounded-2xl rounded-tl-none p-3 self-start max-w-[85%] text-zinc-500 flex items-center gap-2 text-xs font-medium animate-pulse shadow-sm">
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

            {/* Input Row */}
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
                className="flex-1 px-3.5 py-2 border border-zinc-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-sm font-medium rounded-xl disabled:bg-zinc-50 disabled:text-zinc-400"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isTyping}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white disabled:bg-zinc-100 disabled:text-zinc-400 disabled:border-zinc-200 border border-transparent font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                <Send size={12} /> Send
              </button>
            </form>
          </div>

        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/30 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-lg text-sm shadow-sm transition-all cursor-pointer"
          >
            Close Audit Details
          </button>
        </div>

      </div>
    </div>
  );
}
