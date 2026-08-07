import React, { useState, useEffect } from "react";
import { ShieldCheck, Check, RotateCcw, UserCheck, Loader2, MessageSquare } from "lucide-react";
import { updateSubmissionDecision } from "@/app/actions/submissions";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import type { SubmissionContext } from "@/lib/types";

interface HODDecisionPanelProps {
  submission: SubmissionContext | null | undefined;
  isHODOrAdmin: boolean;
  onDecisionUpdated: (newDecision: "APPROVED" | "REVISION_REQUESTED" | "NEEDS_OBSERVATION") => void;
}

export default function HODDecisionPanel({ submission, isHODOrAdmin, onDecisionUpdated }: HODDecisionPanelProps) {
  const [hodDecision, setHodDecision] = useState<"APPROVED" | "REVISION_REQUESTED" | "NEEDS_OBSERVATION" | null>(
    submission?.hod_decision || null
  );
  const [hodComments, setHodComments] = useState(submission?.hod_feedback || "");
  const [isSavingDecision, setIsSavingDecision] = useState(false);

  useEffect(() => {
    if (submission) {
      setHodDecision(submission.hod_decision || null);
      setHodComments(submission.hod_feedback || "");
    }
  }, [submission]);

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
      <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800 uppercase tracking-wider">
          <MessageSquare size={14} className="text-amber-600" /> HOD Feedback Notes
        </div>
        <p className="text-xs text-zinc-700 leading-relaxed italic">{submission.hod_feedback}</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-widest">
          <ShieldCheck size={16} className="text-amber-600" /> HOD Pedagogical Decision
        </div>
        {submission?.hod_updated_by && (
          <span className="text-[11px] text-zinc-400 italic">Updated by {submission.hod_updated_by}</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          onClick={() => handleSaveDecision("APPROVED")}
          disabled={isSavingDecision}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-extrabold text-xs transition-all cursor-pointer ${
            hodDecision === "APPROVED"
              ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/30"
              : "bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          }`}
        >
          <Check size={14} /> Approve Plan
        </button>
        <button
          onClick={() => handleSaveDecision("REVISION_REQUESTED")}
          disabled={isSavingDecision}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-extrabold text-xs transition-all cursor-pointer ${
            hodDecision === "REVISION_REQUESTED"
              ? "bg-amber-600 text-white shadow-sm ring-2 ring-amber-600/30"
              : "bg-white border border-amber-300 text-amber-800 hover:bg-amber-50"
          }`}
        >
          <RotateCcw size={14} /> Request Revision
        </button>
        <button
          onClick={() => handleSaveDecision("NEEDS_OBSERVATION")}
          disabled={isSavingDecision}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-extrabold text-xs transition-all cursor-pointer ${
            hodDecision === "NEEDS_OBSERVATION"
              ? "bg-purple-600 text-white shadow-sm ring-2 ring-purple-600/30"
              : "bg-white border border-purple-300 text-purple-800 hover:bg-purple-50"
          }`}
        >
          <UserCheck size={14} /> Mark for Peer Observation
        </button>
      </div>

      <div className="space-y-1.5 pt-2">
        <label className="block text-xs font-bold text-zinc-700">HOD Feedback Notes for Teacher</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={hodComments}
            onChange={(e) => setHodComments(e.target.value)}
            placeholder="Add constructive feedback or specific suggestions for revision..."
            className="flex-1 px-3 py-1.5 text-xs border border-zinc-300 rounded-lg outline-none focus:ring-1 focus:ring-amber-500 bg-white"
          />
          <button
            onClick={() => {
              if (hodDecision) handleSaveDecision(hodDecision);
              else toast.info("Please select a decision first.");
            }}
            disabled={isSavingDecision || !hodDecision}
            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            {isSavingDecision ? <Loader2 size={12} className="animate-spin" /> : "Save Notes"}
          </button>
        </div>
      </div>
    </div>
  );
}
