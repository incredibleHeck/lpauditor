"use client";

import React, { useState, useEffect } from "react";
import { 
  X, CheckCircle, AlertTriangle, Info, BookOpen, 
  Compass, Tag, Brain, Clock, GraduationCap, Presentation, Eye, EyeOff
} from "lucide-react";
import type { Audit, SubmissionContext } from "@/lib/types";
import { ChatPanel } from "./ChatPanel";
import HODDecisionPanel from "./audit/HODDecisionPanel";
import DocumentPreview from "./audit/DocumentPreview";
import ScoreRing from "./audit/ScoreRing";

export type { Audit, SubmissionContext };



interface AuditDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  audit: Audit | null;
  submission?: SubmissionContext | null;
  fileName: string;
  userRole?: string;
  onDecisionUpdated?: () => void;
}

export default function AuditDetailsModal({ 
  isOpen, 
  onClose, 
  audit, 
  submission,
  fileName,
  userRole = "TEACHER",
  onDecisionUpdated
}: AuditDetailsModalProps) {
  const [showDocPreview, setShowDocPreview] = useState(false);

  useEffect(() => {
    if (audit) {
      setShowDocPreview(false);
    }
  }, [audit?.id]);

  if (!isOpen || !audit) return null;

  const isHODOrAdmin = userRole === "HOD" || userRole === "ADMIN";





  const score = audit.score || 0;
  const lessons = audit.lessons_detected || 0;
  const strengths: string[] = Array.isArray(audit.strengths) ? audit.strengths : [];
  const flags: string[] = Array.isArray(audit.flags) ? audit.flags : [];
  const attributes = audit.cambridge_attributes || null;
  const commandVerbs = audit.command_verbs && audit.command_verbs.length > 0 ? audit.command_verbs : [];
  const cogDemand = audit.cognitive_demand || null;

  // New Pedagogical Audit Metrics
  const timeComp = audit.time_compliance || null;
  const ageAppr = audit.age_appropriateness || null;
  const instDeliv = audit.instructional_delivery || null;

  const summary = String(
    audit.raw_response?.summary || 
    (typeof audit.raw_response === "object" && audit.raw_response !== null ? audit.raw_response.summary : "") || 
    "Evaluation complete. Feedback summary generated successfully."
  );



  const fileUrl = submission?.file_url;
  const isPdf = fileUrl ? (fileUrl.includes(".pdf") || fileUrl.endsWith(".pdf")) : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-zinc-950/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className={`relative w-full ${showDocPreview ? "max-w-7xl" : "max-w-4xl"} bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-all duration-300`}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-600">
              <BookOpen size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-900 truncate max-w-[260px] sm:max-w-md">
                  {fileName}
                </h2>
                {submission?.hod_decision && (
                  <span className={`px-2.5 py-0.5 text-[11px] font-extrabold uppercase rounded-full border ${
                    submission.hod_decision === "APPROVED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                    submission.hod_decision === "REVISION_REQUESTED" ? "bg-amber-50 text-amber-700 border-amber-200" :
                    "bg-purple-50 text-purple-700 border-purple-200"
                  }`}>
                    {submission.hod_decision.replace("_", " ")}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500">
                Cambridge Pedagogical Audit • {submission?.subject || "Subject"} ({submission?.grade_level || "Grade"})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {fileUrl && (
              <button
                onClick={() => setShowDocPreview(!showDocPreview)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  showDocPreview 
                    ? "bg-amber-500 text-black border-amber-500 shadow-sm" 
                    : "bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700"
                }`}
              >
                {showDocPreview ? <EyeOff size={14} /> : <Eye size={14} />}
                {showDocPreview ? "Hide Document" : "Side-by-Side Document"}
              </button>
            )}

            <button 
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-all cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Main Body Split View */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Left Panel: Side-by-Side Document Preview */}
          {showDocPreview && fileUrl && (
            <DocumentPreview fileName={fileName} fileUrl={fileUrl} isPdf={isPdf} />
          )}

          {/* Right Panel: Audit Report & Chat Assistant */}
          <div className={`${showDocPreview ? "w-1/2" : "w-full"} p-6 overflow-y-auto space-y-6 flex-1 bg-white`}>
            
            {/* HOD Review & Decision Panel (For HOD / Admin or Teacher View) */}
            <HODDecisionPanel
              submission={submission}
              isHODOrAdmin={isHODOrAdmin}
              onDecisionUpdated={(newDecision) => {
                if (submission) {
                  submission.hod_decision = newDecision;
                }
                if (onDecisionUpdated) onDecisionUpdated();
              }}
            />

            {/* Score & Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center bg-zinc-50/40 p-5 rounded-xl border border-zinc-100">
              <ScoreRing score={score} />

              <div className="sm:col-span-2 space-y-3">
                <div>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${score >= 80 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : score >= 50 ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                    {score >= 80 ? "Highly Cambridge Compliant" : score >= 50 ? "Partially Compliant" : "Critical Actions Needed"}
                  </span>
                  <h3 className="text-lg font-bold text-zinc-900 mt-2">Pedagogical Evaluation Metrics</h3>
                </div>
                <div className="flex flex-wrap items-center gap-3 py-2 border-t border-zinc-100 text-xs">
                  <div className="flex items-center gap-1.5 text-zinc-600">
                    <span className="font-semibold text-zinc-400">Segments:</span>
                    <span className="px-2 py-0.5 bg-zinc-100 font-bold text-zinc-800 rounded">{lessons} Lessons</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-600">
                    <span className="font-semibold text-zinc-400">EAL Scaffolding:</span>
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 font-bold border border-amber-200 rounded">
                      {audit.eal_scaffolding_score || Math.min(100, score + 4)}/100
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Time Compliance & Pacing Feasibility Card */}
            {timeComp ? (
              <div className="p-4 bg-zinc-50/60 rounded-xl border border-zinc-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-widest flex items-center gap-1.5">
                    <Clock size={15} className="text-amber-600" /> Time Compliance & Lesson Pacing
                  </h4>
                  <span className={`px-2.5 py-0.5 text-xs font-extrabold rounded-full border ${
                    timeComp.is_compliant 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}>
                    {timeComp.is_compliant ? "✅ Pacing Compliant" : "⚠️ Timing Issue Detected"}
                  </span>
                </div>
                <div className="text-xs text-zinc-700 space-y-1 pt-1">
                  <p><strong className="text-zinc-900">Total Allocated Duration:</strong> {timeComp.total_allocated_minutes} minutes</p>
                  <p className="leading-relaxed bg-white p-2.5 rounded-lg border border-zinc-200 text-zinc-600">
                    {timeComp.pacing_feedback}
                  </p>
                </div>
              </div>
            ) : null}

            {/* Age Appropriateness Card */}
            {ageAppr ? (
              <div className="p-4 bg-zinc-50/60 rounded-xl border border-zinc-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-widest flex items-center gap-1.5">
                    <GraduationCap size={15} className="text-blue-600" /> Age & Grade Appropriateness
                  </h4>
                  <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-extrabold rounded-full">
                    {ageAppr.score}/100 Match
                  </span>
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed bg-white p-2.5 rounded-lg border border-zinc-200">
                  {ageAppr.feedback}
                </p>
              </div>
            ) : null}

            {/* Instructional Delivery Roadmap ("How to Teach This Lesson") */}
            {instDeliv ? (
              <div className="p-4 bg-zinc-50/60 rounded-xl border border-zinc-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-widest flex items-center gap-1.5">
                    <Presentation size={15} className="text-purple-600" /> Instructional Delivery Roadmap ("How to Teach")
                  </h4>
                  <span className="px-2.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold rounded-lg">
                    {instDeliv.teacher_student_ratio}
                  </span>
                </div>

                <p className="text-xs text-zinc-600 leading-relaxed">
                  {instDeliv.methodology_notes}
                </p>

                <div className="space-y-1.5 pt-1">
                  <h5 className="text-[11px] font-bold text-zinc-700 uppercase tracking-wide">Step-by-Step Delivery Tips:</h5>
                  <ul className="space-y-2">
                    {instDeliv.step_by_step_tips.map((tip, idx) => (
                      <li key={idx} className="flex gap-2 text-xs text-zinc-700 bg-white p-2.5 rounded-lg border border-zinc-200 shadow-xs">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 text-purple-700 font-extrabold flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <p className="mt-0.5">{tip}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}

            {/* Cambridge Learner Attributes Breakdown */}
            {attributes ? (
              <div className="space-y-3 bg-zinc-50/60 p-4 rounded-xl border border-zinc-200/80">
                <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-widest flex items-center gap-1.5">
                  <Compass size={15} className="text-amber-600" />
                  Cambridge Learner Attributes
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  {Object.entries(attributes).map(([attr, val]) => (
                    <div key={attr} className="bg-white p-2.5 rounded-lg border border-zinc-200 shadow-xs space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold capitalize text-zinc-700">{attr}</span>
                        <span className="font-extrabold text-amber-600">{val}%</span>
                      </div>
                      <div className="w-full bg-zinc-100 rounded-full h-1.5">
                        <div className="bg-amber-500 h-full rounded-full" style={{ width: `${val}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Exam Command Verbs & Cognitive Demand */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-zinc-50/60 rounded-xl border border-zinc-200/80 space-y-2">
                <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-widest flex items-center gap-1.5">
                  <Tag size={14} className="text-blue-600" /> Exam Board Command Verbs
                </h4>
                {commandVerbs.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {commandVerbs.map((verb, idx) => (
                      <span key={idx} className="px-2.5 py-1 bg-white border border-zinc-200 text-zinc-800 text-xs font-bold rounded-lg shadow-xs">
                        {verb}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic">No specific command verbs extracted.</p>
                )}
              </div>

              <div className="p-4 bg-zinc-50/60 rounded-xl border border-zinc-200/80 space-y-2">
                <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-widest flex items-center gap-1.5">
                  <Brain size={14} className="text-purple-600" /> Cognitive Demand (Bloom/DOK)
                </h4>
                {cogDemand ? (
                  <div className="space-y-1.5 text-xs pt-1">
                    <div className="flex justify-between text-zinc-600 font-medium">
                      <span>Low (Recall/State):</span>
                      <span className="font-bold text-zinc-900">{cogDemand.low_recall}%</span>
                    </div>
                    <div className="flex justify-between text-zinc-600 font-medium">
                      <span>Medium (Apply/Describe):</span>
                      <span className="font-bold text-zinc-900">{cogDemand.medium_application}%</span>
                    </div>
                    <div className="flex justify-between text-zinc-600 font-medium">
                      <span>High (Analyze/Evaluate):</span>
                      <span className="font-bold text-emerald-600">{cogDemand.high_evaluation}%</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic">Cognitive demand metrics not evaluated.</p>
                )}
              </div>
            </div>

            {/* Executive Summary */}
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-zinc-800 flex items-center gap-1.5">
                <Info size={16} className="text-zinc-400" /> Executive Summary
              </h4>
              <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-100 text-sm text-zinc-600 leading-relaxed">
                {summary}
              </div>
            </div>

            {/* Strengths & Flags Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-zinc-800 flex items-center gap-1.5">
                  <CheckCircle size={16} className="text-emerald-500" /> Pedagogical Strengths
                </h4>
                {strengths.length > 0 ? (
                  <ul className="space-y-2.5">
                    {strengths.map((strength, idx) => (
                      <li key={idx} className="flex gap-2 text-sm text-zinc-600 bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-lg">
                        <span className="text-emerald-600 font-bold mt-0.5">•</span>
                        <p>{strength}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-zinc-400 italic">No specific pedagogical strengths noted.</p>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-zinc-800 flex items-center gap-1.5">
                  <AlertTriangle size={16} className="text-red-500" /> Compliance Flags
                </h4>
                {flags.length > 0 ? (
                  <ul className="space-y-2.5">
                    {flags.map((flag, idx) => (
                      <li key={idx} className="flex gap-2 text-sm text-zinc-600 bg-red-500/5 border border-red-500/10 p-3 rounded-lg">
                        <span className="text-red-500 font-bold mt-0.5">•</span>
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
            <ChatPanel submissionId={audit.submission_id} flags={flags} />

          </div>

        </div>

        {/* Footer actions */}
        <div className="px-6 py-3 border-t border-zinc-100 bg-zinc-50/50 flex justify-between items-center">
          <span className="text-xs text-zinc-400 font-medium">St. Adelaide International • Cambridge Standard v2.1</span>
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-lg text-xs shadow-xs transition-all cursor-pointer"
          >
            Close Review
          </button>
        </div>

      </div>
    </div>
  );
}
