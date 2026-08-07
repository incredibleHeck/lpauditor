"use client";

import React from "react";
import { CheckCircle, Clock, Loader2, AlertTriangle } from "lucide-react";

interface StatusBadgeProps {
  status: string | null;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const isPending = status === "PENDING";
  const isProcessing = status === "PROCESSING";
  const isCompleted = status === "COMPLETED";
  const isFailed = status === "FAILED";

  if (isPending) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-700 text-xs font-bold rounded-lg">
        <Clock size={13} /> Pending Queue
      </span>
    );
  }

  if (isProcessing) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-700 text-xs font-bold rounded-lg animate-pulse">
        <Loader2 className="animate-spin" size={13} /> Analyzing...
      </span>
    );
  }

  if (isCompleted) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/20 text-green-700 text-xs font-bold rounded-lg">
        <CheckCircle size={13} /> Audit Complete
      </span>
    );
  }

  if (isFailed) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/20 text-red-700 text-xs font-bold rounded-lg">
        <AlertTriangle size={13} /> Audit Failed
      </span>
    );
  }

  return <span className="text-xs text-zinc-400 italic">Unknown</span>;
}
