"use client";

import React from "react";
import { X, CheckCircle, AlertTriangle, Info, BookOpen } from "lucide-react";

interface Audit {
  id: string;
  submission_id: string;
  score: number | null;
  lessons_detected: number | null;
  strengths: any; // string[] stored in JSONB
  flags: any; // string[] stored in JSONB
  raw_response: any; // Full JSON including summary
  created_at: string;
}

interface AuditDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  audit: Audit | null;
  fileName: string;
}

export default function AuditDetailsModal({ isOpen, onClose, audit, fileName }: AuditDetailsModalProps) {
  if (!isOpen || !audit) return null;

  const score = audit.score || 0;
  const lessons = audit.lessons_detected || 0;
  const strengths: string[] = Array.isArray(audit.strengths) ? audit.strengths : [];
  const flags: string[] = Array.isArray(audit.flags) ? audit.flags : [];
  
  // Extract summary from raw_response or default to a generic text
  const summary = (audit.raw_response as any)?.summary || 
                  (typeof audit.raw_response === "object" && audit.raw_response !== null ? (audit.raw_response as any).summary : "") || 
                  "Evaluation complete. Feedback summary generated successfully.";

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
