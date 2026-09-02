import React from "react";
import { CheckCircle2, Clock, Loader2, AlertCircle, AlertTriangle } from "lucide-react";

interface StatusBadgeProps {
  status: string | null;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const isPending = status === "PENDING";
  const isProcessing = status === "PROCESSING";
  const isCompleted = status === "COMPLETED";
  const isResubmission = status === "RESUBMISSION_REQUIRED";
  const isFailed = status === "FAILED";

  if (isPending) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold rounded-md">
        <Clock size={12} className="text-amber-700" /> Pending
      </span>
    );
  }

  if (isProcessing) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-semibold rounded-md animate-pulse">
        <Loader2 className="animate-spin text-blue-700" size={12} /> Analyzing…
      </span>
    );
  }

  if (isCompleted) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold rounded-md">
        <CheckCircle2 size={12} className="text-emerald-700" /> Audited
      </span>
    );
  }

  if (isResubmission) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-semibold rounded-md">
        <AlertTriangle size={12} className="text-rose-700" /> Resubmission Required
      </span>
    );
  }

  if (isFailed) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-semibold rounded-md">
        <AlertCircle size={12} className="text-rose-700" /> Failed
      </span>
    );
  }

  return <span className="text-xs text-slate-400 italic">Unknown</span>;
}
