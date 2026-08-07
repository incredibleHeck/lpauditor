"use client";

import React from "react";
import { FileText, Calendar, Loader2, RefreshCw } from "lucide-react";
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
    <div className="bg-white border border-zinc-200 rounded-xl shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 text-left">
          <thead className="bg-zinc-50/70 text-xs font-bold text-zinc-400 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4">Lesson Plan</th>
              {showTeacherColumn && <th className="px-6 py-4">Teacher</th>}
              <th className="px-6 py-4">Subject</th>
              <th className="px-6 py-4">Week / Grade</th>
              <th className="px-6 py-4">Audit Status</th>
              <th className="px-6 py-4">HOD Decision</th>
              <th className="px-6 py-4">Compliance</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 text-sm font-medium text-zinc-700">
            {submissions.map((sub) => {
              const filename = getFileName(sub.file_url);
              const isCompleted = sub.status === "COMPLETED";
              const isFailed = sub.status === "FAILED";
              const audit = getAuditFromSubmission(sub);

              return (
                <tr key={sub.id} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="px-6 py-4.5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-50 rounded-lg text-amber-600 border border-amber-100 shrink-0">
                        <FileText size={18} />
                      </div>
                      <div className="max-w-[180px] sm:max-w-xs overflow-hidden">
                        <p className="font-bold text-zinc-900 truncate" title={filename}>
                          {filename}
                        </p>
                        <span className="flex items-center gap-1 text-[11px] text-zinc-400 mt-0.5">
                          <Calendar size={12} /> {formatDate(sub.created_at)}
                        </span>
                      </div>
                    </div>
                  </td>

                  {showTeacherColumn && (
                    <td className="px-6 py-4.5 align-middle">
                      <span className="text-zinc-900 font-bold">
                        {sub.profiles?.full_name || "Teacher"}
                      </span>
                    </td>
                  )}

                  <td className="px-6 py-4.5 align-middle">
                    <span className="text-zinc-600">{sub.subject}</span>
                  </td>

                  <td className="px-6 py-4.5 align-middle">
                    <div className="space-y-0.5">
                      <p className="text-zinc-700 font-semibold">{sub.week_name}</p>
                      <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider">
                        {sub.grade_level}
                      </p>
                    </div>
                  </td>

                  <td className="px-6 py-4.5 align-middle">
                    <StatusBadge status={sub.status} />
                  </td>

                  <td className="px-6 py-4.5 align-middle">
                    <HodDecisionBadge decision={sub.hod_decision} />
                  </td>

                  <td className="px-6 py-4.5 align-middle">
                    <ComplianceScoreCell
                      score={audit?.score}
                      isCompleted={isCompleted}
                      isFailed={isFailed}
                    />
                  </td>

                  <td className="px-6 py-4.5 align-middle text-right">
                    {isCompleted && audit ? (
                      <button
                        onClick={() => onViewAudit(sub)}
                        className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-lg shadow-xs transition-all cursor-pointer"
                      >
                        {showTeacherColumn ? "Review & Audit" : "Review Feedback"}
                      </button>
                    ) : isFailed && onRetry ? (
                      <button
                        onClick={() => onRetry(sub.id)}
                        disabled={retryingId === sub.id}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg shadow-xs transition-all flex items-center gap-1 cursor-pointer ml-auto"
                      >
                        {retryingId === sub.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <RefreshCw size={13} />
                        )}
                        Retry Audit
                      </button>
                    ) : (
                      <button
                        disabled
                        className="px-3 py-1.5 bg-zinc-100 text-zinc-400 border border-zinc-200 font-bold text-xs rounded-lg cursor-not-allowed"
                      >
                        Feedback Locked
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
