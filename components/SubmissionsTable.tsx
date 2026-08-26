"use client";

import React from "react";
import { FileText, Calendar, Loader2, RefreshCw, ArrowUpRight } from "lucide-react";
import type { Submission } from "@/lib/types";
import { getFileName, formatDate, getAuditFromSubmission } from "@/lib/format-utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { HodDecisionBadge } from "@/components/ui/HodDecisionBadge";
import { ComplianceScoreCell } from "@/components/ui/ComplianceScoreCell";

interface SubmissionsTableProps {
  submissions: Submission[];
  showTeacherColumn?: boolean;
  onViewAudit: (sub: Submission) => void;
  onRetry?: (submissionId: string) => void;
  retryingId?: string | null;
}

export function SubmissionsTable({
  submissions,
  showTeacherColumn = false,
  onViewAudit,
  onRetry,
  retryingId,
}: SubmissionsTableProps) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-left font-sans">
          <thead className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3.5">Lesson Plan</th>
              {showTeacherColumn && <th className="px-5 py-3.5">Faculty</th>}
              <th className="px-5 py-3.5">Department</th>
              <th className="px-5 py-3.5">Week & Grade</th>
              <th className="px-5 py-3.5">Audit Status</th>
              <th className="px-5 py-3.5">HOD Review</th>
              <th className="px-5 py-3.5">Compliance Score</th>
              <th className="px-5 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
            {submissions.map((sub) => {
              const filename = getFileName(sub.file_url);
              const isCompleted = sub.status === "COMPLETED";
              const isFailed = sub.status === "FAILED";
              const audit = getAuditFromSubmission(sub);

              return (
                <tr key={sub.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 text-slate-700 rounded-lg shrink-0">
                        <FileText size={16} />
                      </div>
                      <div className="max-w-[170px] sm:max-w-xs overflow-hidden">
                        <p className="font-semibold text-slate-900 truncate" title={filename}>
                          {filename}
                        </p>
                        <span className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                          <Calendar size={11} /> {formatDate(sub.created_at)}
                        </span>
                      </div>
                    </div>
                  </td>

                  {showTeacherColumn && (
                    <td className="px-5 py-4 align-middle">
                      <span className="text-slate-900 font-semibold">
                        {sub.profiles?.full_name || "Faculty Member"}
                      </span>
                    </td>
                  )}

                  <td className="px-5 py-4 align-middle">
                    <span className="text-slate-600 font-medium">{sub.subject}</span>
                  </td>

                  <td className="px-5 py-4 align-middle">
                    <div className="space-y-0.5">
                      <p className="text-slate-800 font-semibold">{sub.week_name}</p>
                      <p className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider">
                        {sub.grade_level}
                      </p>
                    </div>
                  </td>

                  <td className="px-5 py-4 align-middle">
                    <StatusBadge status={sub.status} />
                  </td>

                  <td className="px-5 py-4 align-middle">
                    <HodDecisionBadge decision={sub.hod_decision} />
                  </td>

                  <td className="px-5 py-4 align-middle">
                    <ComplianceScoreCell
                      score={audit?.score}
                      isCompleted={isCompleted}
                      isFailed={isFailed}
                    />
                  </td>

                  <td className="px-5 py-4 align-middle text-right">
                    {isCompleted && audit ? (
                      <button
                        onClick={() => onViewAudit(sub)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-2xs transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-900/20 active:scale-[0.99]"
                      >
                        <span>{showTeacherColumn ? "Review & Audit" : "View Feedback"}</span>
                        <ArrowUpRight size={13} />
                      </button>
                    ) : isFailed && onRetry ? (
                      <button
                        onClick={() => onRetry(sub.id)}
                        disabled={retryingId === sub.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg shadow-2xs transition-all cursor-pointer ml-auto focus-visible:ring-2 focus-visible:ring-rose-600/20 active:scale-[0.99] disabled:opacity-50"
                      >
                        {retryingId === sub.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <RefreshCw size={12} />
                        )}
                        <span>Retry Audit</span>
                      </button>
                    ) : (
                      <button
                        disabled
                        className="px-3 py-1.5 bg-slate-100 text-slate-400 font-medium text-xs rounded-lg cursor-not-allowed border border-slate-200/60"
                      >
                        Locked
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
