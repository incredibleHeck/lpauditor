"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, Check, RotateCcw, UserCheck, Loader2, MessageSquare } from "lucide-react";
import { updateSubmissionDecision } from "@/app/actions/submissions";
import { toast } from "sonner";
import type { SubmissionContext } from "@/lib/types";

interface HODDecisionPanelProps {
  submission: SubmissionContext | null | undefined;
  isHODOrAdmin: boolean;
  onDecisionUpdated: (newDecision: "APPROVED" | "REVISION_REQUESTED" | "NEEDS_OBSERVATION") => void;
}

export default function HODDecisionPanel({ submission, isHODOrAdmin, onDecisionUpdated }: HODDecisionPanelProps) {
  const [prevSubmissionId, setPrevSubmissionId] = useState<string | undefined>(submission?.id);
  const [hodDecision, setHodDecision] = useState<"APPROVED" | "REVISION_REQUESTED" | "NEEDS_OBSERVATION" | null>(
    submission?.hod_decision || null
  );
  const [hodComments, setHodComments] = useState(submission?.hod_feedback || "");
  const [isSavingDecision, setIsSavingDecision] = useState(false);

  if (submission?.id !== prevSubmissionId) {
    setPrevSubmissionId(submission?.id);
    setHodDecision(submission?.hod_decision || null);
    setHodComments(submission?.hod_feedback || "");
  }

  const handleSaveDecision = async (decisionToSave: "APPROVED" | "REVISION_REQUESTED" | "NEEDS_OBSERVATION") => {
    if (!submission?.id) return;
    setIsSavingDecision(true);
    try {
      const res = await updateSubmissionDecision({
        submissionId: submission.id,
        decision: decisionToSave,
        comments: hodComments
      });

      if (res.success) {
        setHodDecision(decisionToSave);
        toast.success(`Submission marked as ${decisionToSave.replace("_", " ")}`);
        onDecisionUpdated(decisionToSave);
      } else {
        toast.error(res.error || "Failed to update decision.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error updating decision.");
    } finally {
      setIsSavingDecision(false);
    }
  };

  if (!isHODOrAdmin) {
    if (!submission?.hod_feedback) return null;
    return (
      <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1 font-sans">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
          <MessageSquare size={14} className="text-slate-600" /> HOD Reviewer Feedback
        </div>
        <p className="text-xs text-slate-700 leading-relaxed italic">{submission.hod_feedback}</p>
      </div>
    );
  }

  return (
    <div className="p-5 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3.5 font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
          <ShieldCheck size={16} className="text-slate-700" /> HOD Pedagogical Review & Action
        </div>
        {submission?.hod_updated_by && (
          <span className="text-[11px] text-slate-400 font-medium">Updated by {submission.hod_updated_by}</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleSaveDecision("APPROVED")}
          disabled={isSavingDecision}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs transition-all cursor-pointer ${
            hodDecision === "APPROVED"
              ? "bg-emerald-700 text-white shadow-2xs"
              : "bg-white border border-slate-200 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 shadow-2xs"
          }`}
        >
          <Check size={13} /> Approve Plan
        </button>
        <button
          onClick={() => handleSaveDecision("REVISION_REQUESTED")}
          disabled={isSavingDecision}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs transition-all cursor-pointer ${
            hodDecision === "REVISION_REQUESTED"
              ? "bg-amber-700 text-white shadow-2xs"
              : "bg-white border border-slate-200 text-slate-700 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200 shadow-2xs"
          }`}
        >
          <RotateCcw size={13} /> Request Revision
        </button>
        <button
          onClick={() => handleSaveDecision("NEEDS_OBSERVATION")}
          disabled={isSavingDecision}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs transition-all cursor-pointer ${
            hodDecision === "NEEDS_OBSERVATION"
              ? "bg-indigo-700 text-white shadow-2xs"
              : "bg-white border border-slate-200 text-slate-700 hover:bg-indigo-50 hover:text-indigo-800 hover:border-indigo-200 shadow-2xs"
          }`}
        >
          <UserCheck size={13} /> Schedule Peer Observation
        </button>
      </div>

      <div className="space-y-1.5 pt-1">
        <label className="block text-xs font-semibold text-slate-700">Constructive Notes for Faculty Member</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={hodComments}
            onChange={(e) => setHodComments(e.target.value)}
            placeholder="Add specific recommendations or actionable suggestions for revision…"
            className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 bg-white"
          />
          <button
            onClick={() => {
              if (hodDecision) handleSaveDecision(hodDecision);
              else toast.info("Please select a decision first.");
            }}
            disabled={isSavingDecision || !hodDecision}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50"
          >
            {isSavingDecision ? <Loader2 size={12} className="animate-spin" /> : "Save Notes"}
          </button>
        </div>
      </div>
    </div>
  );
}
