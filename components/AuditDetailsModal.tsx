"use client";

import React, { useState } from "react";
import { 
  X, CheckCircle2, AlertTriangle, BookOpen, 
  Compass, Tag, Brain, Clock, GraduationCap, Presentation, Eye, EyeOff, Award, History, Printer
} from "lucide-react";
import dynamic from "next/dynamic";
import type { Audit, SubmissionContext } from "@/lib/types";
import { ChatPanel } from "./ChatPanel";
import HODDecisionPanel from "./audit/HODDecisionPanel";
import ScoreRing from "./audit/ScoreRing";
import CertificateExportModal from "./audit/CertificateExportModal";

const DocumentPreview = dynamic(() => import("./audit/DocumentPreview"), { 
  ssr: false,
  loading: () => <div className="w-1/2 p-8 text-center text-xs text-slate-400">Loading document viewer…</div>
});

export type { Audit, SubmissionContext };

interface AuditDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  audit: Audit | null;
  submission?: SubmissionContext | null;
  fileName: string;
  userRole?: string;
  teacherName?: string;
  onDecisionUpdated?: () => void;
  onRequestRevision?: (submission: SubmissionContext) => void;
}

export default function AuditDetailsModal({ 
  isOpen, 
  onClose, 
  audit, 
  submission,
  fileName,
  userRole = "TEACHER",
  teacherName = "Faculty Member",
  onDecisionUpdated,
  onRequestRevision,
}: AuditDetailsModalProps) {
  const [showDocPreview, setShowDocPreview] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);
  const [prevAuditId, setPrevAuditId] = useState(audit?.id);

  if (audit?.id !== prevAuditId) {
    setPrevAuditId(audit?.id);
    setShowDocPreview(false);
    setShowCertModal(false);
  }

  if (!isOpen || !audit) return null;

  const isHODOrAdmin = userRole === "HOD" || userRole === "ADMIN";

  const score = audit.score || 0;
  const lessons = audit.lessons_detected || 0;
  const strengths: string[] = Array.isArray(audit.strengths) ? audit.strengths : [];
  const flags: string[] = Array.isArray(audit.flags) ? audit.flags : [];
  const attributes = audit.cambridge_attributes || null;
  const commandVerbs = audit.command_verbs && audit.command_verbs.length > 0 ? audit.command_verbs : [];
  const cogDemand = audit.cognitive_demand || null;

  // Pedagogical Audit Metrics
  const timeComp = audit.time_compliance || null;
  const ageAppr = audit.age_appropriateness || null;
  const instDeliv = audit.instructional_delivery || null;

  const fileUrl = submission?.file_url;
  const isPdf = fileUrl ? (fileUrl.includes(".pdf") || fileUrl.endsWith(".pdf")) : false;
  const isRevisionRequested = submission?.hod_decision === "REVISION_REQUESTED";
  const version = submission?.version || 1;

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-fade-in font-sans print:static print:p-0 print:bg-transparent print:backdrop-blur-none">
        <div className={`relative w-full ${showDocPreview ? "max-w-7xl" : "max-w-4xl"} bg-white border border-slate-200/80 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[92vh] transition-all duration-300 print:max-w-full print:border-none print:shadow-none print:max-h-none print:rounded-none`}>
          
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 print:hidden">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-2xs">
                <BookOpen size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900 truncate max-w-[240px] sm:max-w-md">
                    {fileName}
                  </h2>
                  {version > 1 && (
                    <span className="px-2 py-0.5 text-[10px] font-bold font-mono uppercase rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200">
                      v{version} (Revision)
                    </span>
                  )}
                  {submission?.hod_decision && (
                    <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-md border ${
                      submission.hod_decision === "APPROVED" ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
                      submission.hod_decision === "REVISION_REQUESTED" ? "bg-amber-50 text-amber-800 border-amber-200" :
                      "bg-indigo-50 text-indigo-800 border-indigo-200"
                    }`}>
                      {submission.hod_decision.replace("_", " ")}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Cambridge Pedagogical Compliance Report • {submission?.subject || "Subject"} ({submission?.grade_level || "Grade Level"})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-all cursor-pointer"
                title="Print official Cambridge evaluation document sheet"
              >
                <Printer size={13} className="text-slate-800" />
                <span>Print</span>
              </button>
              <button
                onClick={() => setShowCertModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-all cursor-pointer"
              >
                <Award size={13} className="text-slate-800" />
                <span>Certificate</span>
              </button>

              {fileUrl && (
                <button
                  onClick={() => setShowDocPreview(!showDocPreview)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                    showDocPreview 
                      ? "bg-slate-900 text-white border-slate-900 shadow-2xs" 
                      : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-2xs"
                  }`}
                >
                  {showDocPreview ? <EyeOff size={13} /> : <Eye size={13} />}
                  <span>{showDocPreview ? "Hide Document" : "Side-by-Side View"}</span>
                </button>
              )}

              <button 
                onClick={onClose}
                aria-label="Close dialog"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Main Body Split View */}
          <div className="flex flex-1 overflow-hidden print:overflow-visible print:block">
            
            {/* Left Panel: Side-by-Side Document Preview (Hidden on print) */}
            {showDocPreview && fileUrl && (
              <div className="w-1/2 no-print print:hidden">
                <DocumentPreview fileName={fileName} fileUrl={fileUrl} isPdf={isPdf} flags={flags} />
              </div>
            )}

            {/* Right Panel: Audit Report Content (Full width on print) */}
            <div id="audit-report-content" className={`${showDocPreview ? "w-1/2" : "w-full"} p-6 sm:p-8 overflow-y-auto space-y-6 flex-1 bg-white print:w-full print:p-0 print:overflow-visible print:space-y-5`}>
              
              {/* Official Institutional Cambridge Evaluation Letterhead */}
              <div className="border-b-2 border-[#0B132B] pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-[#0B132B] text-white flex items-center justify-center font-serif font-black text-xl shadow-xs shrink-0">
                      SA
                    </div>
                    <div>
                      <h1 className="text-base font-bold text-[#0B132B] font-serif tracking-tight uppercase">
                        St. Adelaide International School
                      </h1>
                      <p className="text-[11px] text-slate-500 font-mono">
                        Cambridge International Centre GH-924 • Official Pedagogical Evaluation Document
                      </p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right text-xs">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-100 text-[#0B132B] font-mono font-bold text-[10px] rounded-md border border-slate-200">
                      DOC REF: {audit.id ? audit.id.slice(0, 8).toUpperCase() : "CAM-AUD"}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 font-mono">
                      Faculty: <strong className="text-slate-800">{teacherName}</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* Revision Requested Callout for Teachers */}
              {isRevisionRequested && onRequestRevision && submission && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2.5 shadow-xs print-break-inside-avoid">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-wider">
                      <History size={16} className="text-amber-700" /> Revision Requested by HOD
                    </div>
                    <button
                      onClick={() => {
                        onClose();
                        onRequestRevision(submission);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-900 hover:bg-amber-950 text-white rounded-lg text-xs font-semibold shadow-2xs transition-all cursor-pointer no-print"
                    >
                      <History size={13} /> Submit Revision (v{version + 1})
                    </button>
                  </div>
                  {submission.hod_feedback && (
                    <p className="text-xs text-amber-900 bg-white/80 p-3 rounded-xl border border-amber-200/80 leading-relaxed">
                      <strong>HOD Feedback:</strong> {submission.hod_feedback}
                    </p>
                  )}
                </div>
              )}

              {/* HOD Review & Decision Action Panel */}
              <div className="print-break-inside-avoid">
                <HODDecisionPanel
                  submission={submission}
                  isHODOrAdmin={isHODOrAdmin}
                  onDecisionUpdated={() => {
                    if (onDecisionUpdated) onDecisionUpdated();
                  }}
                />
              </div>

              {/* Score & Overview Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center bg-[#F8FAFC] p-5 rounded-2xl border border-slate-200/90 print-break-inside-avoid">
                <ScoreRing score={score} />

                <div className="sm:col-span-2 space-y-2.5">
                  <div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border ${
                      score >= 80 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 
                      score >= 70 ? 'bg-emerald-50/90 border-emerald-200 text-emerald-800' : 
                      'bg-rose-50 border-rose-200 text-rose-800'
                    }`}>
                      {score >= 80 ? "Exemplary Compliance (≥80%)" : score >= 70 ? "Compliant & Passing (≥70%)" : "Resubmission Required (<70%)"}
                    </span>
                    <h3 className="text-base font-bold text-[#0B132B] mt-1.5 font-serif">Pedagogical Evaluation Summary</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 py-2 border-t border-slate-200/70 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <span className="font-medium text-slate-400">Lesson Segments:</span>
                      <span className="px-2 py-0.5 bg-white border border-slate-200 font-bold font-mono text-slate-800 rounded">{lessons}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <span className="font-medium text-slate-400">EAL Scaffolding:</span>
                      <span className="px-2 py-0.5 bg-white text-slate-800 font-bold font-mono border border-slate-200 rounded">
                        {typeof audit.eal_scaffolding_score === "number" ? `${audit.eal_scaffolding_score}/100` : "Not Assessed"}
                      </span>
                    </div>
                    {audit.rubric_type && (
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <span className="font-medium text-slate-400">Standard:</span>
                        <span className="px-2 py-0.5 bg-white border border-slate-200 font-semibold text-[11px] text-slate-700 rounded">
                          {audit.rubric_type === "CAMBRIDGE" ? "Cambridge Framework" : "Universal Pedagogy"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Time Compliance & Pacing Feasibility Card */}
              {timeComp && (
                <div className="p-4 bg-[#F8FAFC] rounded-2xl border border-slate-200/90 space-y-2 print-break-inside-avoid">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[#0B132B] uppercase tracking-wider flex items-center gap-1.5">
                      <Clock size={14} className="text-slate-700" /> Time Compliance & Pacing
                    </h4>
                    <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${
                      timeComp.is_compliant 
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                        : "bg-rose-50 text-rose-800 border-rose-200"
                    }`}>
                      {timeComp.is_compliant ? "Pacing Compliant" : "Pacing Issue Flagged"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-700 space-y-1 pt-1">
                    <p><strong className="text-slate-900">Total Allocated Duration:</strong> {timeComp.total_allocated_minutes}&nbsp;minutes</p>
                    <p className="leading-relaxed bg-white p-3 rounded-xl border border-slate-200/70 text-slate-600">
                      {timeComp.pacing_feedback}
                    </p>
                  </div>
                </div>
              )}

              {/* Age Appropriateness Card */}
              {ageAppr && (
                <div className="p-4 bg-[#F8FAFC] rounded-2xl border border-slate-200/90 space-y-2 print-break-inside-avoid">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[#0B132B] uppercase tracking-wider flex items-center gap-1.5">
                      <GraduationCap size={15} className="text-slate-700" /> Age & Grade Level Appropriateness
                    </h4>
                    <span className="px-2 py-0.5 bg-white text-slate-800 border border-slate-200 text-[11px] font-mono font-bold rounded-md">
                      {ageAppr.score}/100 Match
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed bg-white p-3 rounded-xl border border-slate-200/70">
                    {ageAppr.feedback}
                  </p>
                </div>
              )}

              {/* Instructional Delivery Roadmap */}
              {instDeliv && (
                <div className="p-4 bg-[#F8FAFC] rounded-2xl border border-slate-200/90 space-y-3 print-break-inside-avoid">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[#0B132B] uppercase tracking-wider flex items-center gap-1.5">
                      <Presentation size={15} className="text-slate-700" /> Instructional Delivery Roadmap (&ldquo;How to Teach&rdquo;)
                    </h4>
                    <span className="px-2 py-0.5 bg-white border border-slate-200 text-slate-700 text-[11px] font-semibold rounded-md">
                      Ratio: {instDeliv.teacher_student_ratio}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {instDeliv.methodology_notes}
                  </p>

                  <div className="space-y-1.5 pt-1">
                    <h5 className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">Step-by-Step Delivery Recommendations:</h5>
                    <ul className="space-y-2">
                      {instDeliv.step_by_step_tips.map((tip, idx) => (
                        <li key={idx} className="flex gap-2.5 text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200/70 shadow-2xs">
                          <span className="shrink-0 w-5 h-5 rounded-full bg-slate-100 text-[#0B132B] font-bold font-mono flex items-center justify-center text-[10px]">
                            {idx + 1}
                          </span>
                          <p className="mt-0.5 leading-relaxed">{tip}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Cambridge Learner Attributes Breakdown */}
              {attributes && (
                <div className="space-y-3 bg-[#F8FAFC] p-4 rounded-2xl border border-slate-200/90 print-break-inside-avoid">
                  <h4 className="text-xs font-bold text-[#0B132B] uppercase tracking-wider flex items-center gap-1.5">
                    <Compass size={15} className="text-slate-700" />
                    Cambridge Learner Attributes
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                    {Object.entries(attributes).map(([attr, val]) => (
                      <div key={attr} className="bg-white p-2.5 rounded-xl border border-slate-200/70 shadow-2xs space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold capitalize text-slate-700 text-[11px]">{attr}</span>
                          <span className="font-mono font-bold text-slate-900 tabular-nums text-xs">{val}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-[#0B132B] h-full rounded-full" style={{ width: `${val}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Exam Command Verbs & Cognitive Demand */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print-break-inside-avoid">
                <div className="p-4 bg-[#F8FAFC] rounded-2xl border border-slate-200/90 space-y-2">
                  <h4 className="text-xs font-bold text-[#0B132B] uppercase tracking-wider flex items-center gap-1.5">
                    <Tag size={14} className="text-slate-700" /> Exam Board Command Verbs
                  </h4>
                  {commandVerbs.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {commandVerbs.map((verb, idx) => (
                        <span key={idx} className="px-2.5 py-1 bg-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg shadow-2xs font-mono">
                          {verb}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No specific command verbs detected in document.</p>
                  )}
                </div>

                <div className="p-4 bg-[#F8FAFC] rounded-2xl border border-slate-200/90 space-y-2">
                  <h4 className="text-xs font-bold text-[#0B132B] uppercase tracking-wider flex items-center gap-1.5">
                    <Brain size={14} className="text-slate-700" /> Cognitive Demand (Bloom&apos;s Taxonomy)
                  </h4>
                  {cogDemand ? (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Low (Recall):</span>
                        <span className="font-bold font-mono text-slate-900">{cogDemand.low_recall}%</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Medium (Application):</span>
                        <span className="font-bold font-mono text-slate-900">{cogDemand.medium_application}%</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>High (Evaluation):</span>
                        <span className="font-bold font-mono text-slate-900">{cogDemand.high_evaluation}%</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Cognitive demand metrics not calculated.</p>
                  )}
                </div>
              </div>

              {/* Pedagogical Strengths & Flags */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print-break-inside-avoid">
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 size={15} className="text-emerald-600" /> Pedagogical Strengths ({strengths.length})
                  </h4>
                  {strengths.length > 0 ? (
                    <ul className="space-y-2">
                      {strengths.map((str, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl">
                          <span className="text-emerald-700 font-bold shrink-0 mt-0.5">•</span>
                          <p className="leading-relaxed">{str}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No specific strengths recorded.</p>
                  )}
                </div>

                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle size={15} className="text-rose-600" /> Compliance Flags ({flags.length})
                  </h4>
                  {flags.length > 0 ? (
                    <ul className="space-y-2">
                      {flags.map((flag, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700 bg-rose-50/50 border border-rose-100 p-3 rounded-xl">
                          <span className="text-rose-700 font-bold shrink-0 mt-0.5">•</span>
                          <p className="leading-relaxed">{flag}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl">
                      <CheckCircle2 size={16} className="text-emerald-700" />
                      <span>Zero compliance failures detected for this plan.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Chat Section (Hidden on Print) */}
              <div className="no-print print:hidden">
                <ChatPanel submissionId={audit.submission_id} flags={flags} />
              </div>

            </div>

          </div>

          {/* Footer actions (Hidden on Print) */}
          <div className="px-6 py-3.5 border-t border-slate-100 bg-[#F8FAFC] flex justify-between items-center no-print print:hidden">
            <span className="text-[11px] text-slate-400 font-medium">St. Adelaide International School • Cambridge Standard v2.1</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold rounded-xl text-xs shadow-2xs transition-all tactile-btn cursor-pointer"
              >
                <Printer size={13} />
                <span>Print Document</span>
              </button>
              <button 
                onClick={() => setShowCertModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0B132B] hover:bg-slate-800 text-white font-semibold rounded-xl text-xs shadow-2xs transition-all tactile-btn cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-900/20"
              >
                <Award size={13} />
                <span>Export Official Certificate</span>
              </button>
              <button 
                onClick={onClose}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold rounded-xl text-xs shadow-2xs transition-all tactile-btn cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Certificate Export Modal */}
      <CertificateExportModal
        isOpen={showCertModal}
        onClose={() => setShowCertModal(false)}
        audit={audit}
        submission={submission}
        teacherName={teacherName}
      />
    </>
  );
}
