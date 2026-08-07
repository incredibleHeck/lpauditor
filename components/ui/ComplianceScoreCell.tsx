"use client";

import React from "react";

interface ComplianceScoreCellProps {
  score?: number | null;
  isCompleted: boolean;
  isFailed: boolean;
}

export function ComplianceScoreCell({ score, isCompleted, isFailed }: ComplianceScoreCellProps) {
  if (isCompleted && score !== undefined && score !== null) {
    return (
      <div className="flex items-center gap-2">
        <span
          className={`text-base font-extrabold ${
            score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-red-600"
          }`}
        >
          {score}%
        </span>
        <div className="w-16 bg-zinc-100 rounded-full h-1.5 border border-zinc-200">
          <div
            className={`h-full rounded-full ${
              score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500"
            }`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
    );
  }

  if (isFailed) {
    return <span className="text-xs text-red-400 font-semibold">Auditor Error</span>;
  }

  return <span className="text-xs text-zinc-400 italic">Awaiting analysis</span>;
}
