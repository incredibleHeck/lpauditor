"use client";

import React from "react";
import { Check, RotateCcw, UserCheck } from "lucide-react";

interface HodDecisionBadgeProps {
  decision?: "APPROVED" | "REVISION_REQUESTED" | "NEEDS_OBSERVATION" | null;
}

export function HodDecisionBadge({ decision }: HodDecisionBadgeProps) {
  if (decision === "APPROVED") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 text-emerald-900 border border-emerald-200 text-[11px] font-semibold rounded-lg">
        <Check size={12} className="text-emerald-700" /> Approved
      </span>
    );
  }

  if (decision === "REVISION_REQUESTED") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 text-[11px] font-semibold rounded-lg">
        <RotateCcw size={12} className="text-amber-700" /> Revision Needed
      </span>
    );
  }

  if (decision === "NEEDS_OBSERVATION") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-indigo-50 text-indigo-900 border border-indigo-200 text-[11px] font-semibold rounded-lg">
        <UserCheck size={12} className="text-indigo-700" /> Peer Observation
      </span>
    );
  }

  return <span className="text-[11px] text-slate-400 italic">Pending Review</span>;
}
