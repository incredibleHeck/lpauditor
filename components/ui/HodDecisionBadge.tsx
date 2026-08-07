"use client";

import React from "react";
import { Check, RotateCcw, UserCheck } from "lucide-react";

interface HodDecisionBadgeProps {
  decision?: "APPROVED" | "REVISION_REQUESTED" | "NEEDS_OBSERVATION" | null;
}

export function HodDecisionBadge({ decision }: HodDecisionBadgeProps) {
  if (decision === "APPROVED") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-lg">
        <Check size={13} /> Approved
      </span>
    );
  }

  if (decision === "REVISION_REQUESTED") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-lg">
        <RotateCcw size={13} /> Revision Needed
      </span>
    );
  }

  if (decision === "NEEDS_OBSERVATION") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold rounded-lg">
        <UserCheck size={13} /> Observation
      </span>
    );
  }

  return <span className="text-xs text-zinc-400 italic">Pending HOD Review</span>;
}
