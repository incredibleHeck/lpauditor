"use client";

import React from "react";

interface ComplianceScoreCellProps {
  score?: number | null;
  isCompleted: boolean;
  isFailed: boolean;
}

export function ComplianceScoreCell({ score, isCompleted, isFailed }: ComplianceScoreCellProps) {
  if (isCompleted && score !== undefined && score !== null) {
    const isPass = score >= 70;
    const isDeficit = score >= 50 && score < 70;

    return (
      <div className="flex items-center gap-2">
        <span
          className={`text-xs font-mono font-bold tabular-nums ${
            isPass ? "text-emerald-700" : isDeficit ? "text-amber-700" : "text-rose-700"
          }`}
        >
          {score}%
        </span>
        <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200/80">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isPass ? "bg-emerald-600" : isDeficit ? "bg-amber-500" : "bg-rose-600"
            }`}
            style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
          />
        </div>
      </div>
    );
  }

  if (isFailed) {
    return <span className="text-[11px] text-rose-600 font-semibold">Auditor Error</span>;
  }

  return <span className="text-[11px] text-slate-400 italic">Awaiting analysis</span>;
}
