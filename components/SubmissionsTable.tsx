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
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
      <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
        <table className="min-w-full divide-y divide-slate-100 text-left font-sans">
          <thead className="sticky top-0 z-10 bg-[#F8FAFC] border-b border-slate-200/90 text-[11px] font-bold text-slate-600 uppercase tracking-wider shadow-2xs">
            <tr>
              <th scope="col" className="px-5 py-3.5 whitespace-nowrap">Curriculum Plan</th>
              {showTeacherColumn && <th scope="col" className="px-5 py-3.5 whitespace-nowrap">Faculty Member</th>}
              <th scope="col" className="px-5 py-3.5 whitespace-nowrap">Department</th>
              <th scope="col" className="px-5 py-3.5 whitespace-nowrap">Week & Cohort</th>
              <th scope="col" className="px-5 py-3.5 whitespace-nowrap">Audit Status</th>
              <th scope="col" className="px-5 py-3.5 whitespace-nowrap">HOD Decision</th>
              <th scope="col" className="px-5 py-3.5 whitespace-nowrap">Cambridge Score</th>
              <th scope="col" className="px-5 py-3.5 text-right whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
            {submissions.map((sub) => {
              const filename = getFileName(sub.file_url);
              const isCompleted = sub.status === "COMPLETED";
              const isFailed = sub.status === "FAILED";
              const audit = getAuditFromSubmission(sub);
              const version = sub.version || 1;

              return (
                <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 text-[#0B132B] rounded-xl shrink-0 border border-slate-200/60">
                        <FileText size={16} />
                      </div>
                      <div className="max-w-[180px] sm:max-w-xs overflow-hidden">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-[#0B132B] truncate text-xs" title={filename}>
                            {filename}
                          </p>
                          {version > 1 && (
                            <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-mono font-bold rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200">
                              v{version}
                            </span>
                          )}
                        </div>
                        <span className="flex items-center gap-1 text-[11px] text-slate-400 font-mono mt-0.5 tabular-nums">
                          <Calendar size={11} className="shrink-0" /> {formatDate(sub.created_at)}
                        </span>
                      </div>
                    </div>
                  </td>

                  {showTeacherColumn && (
                    <td className="px-5 py-3.5 align-middle">
                      <span className="text-[#0B132B] font-semibold text-xs">
                        {sub.profiles?.full_name || "Faculty Member"}
                      </span>
                    </td>
                  )}

                  <td className="px-5 py-3.5 align-middle">
                    <span className="text-slate-700 font-medium text-xs">{sub.subject}</span>
                  </td>

                  <td className="px-5 py-3.5 align-middle">
                    <div className="space-y-0.5">
                      <p className="text-slate-900 font-semibold text-xs">{sub.week_name}</p>
                      <p className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-wider">
                        {sub.grade_level}
                      </p>
                    </div>
                  </td>

                  <td className="px-5 py-3.5 align-middle">
                    <StatusBadge status={sub.status} />
                  </td>

                  <td className="px-5 py-3.5 align-middle">
                    <HodDecisionBadge decision={sub.hod_decision} />
                  </td>

                  <td className="px-5 py-3.5 align-middle">
                    <ComplianceScoreCell
                      score={audit?.score}
                      isCompleted={isCompleted}
                      isFailed={isFailed}
                    />
                  </td>

                  <td className="px-5 py-3.5 align-middle text-right">
                    {isCompleted && audit ? (
                      <button
                        onClick={() => onViewAudit(sub)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#0B132B] hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-2xs transition-all tactile-btn cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-900/20"
                      >
                        <span>{showTeacherColumn ? "Review & Audit" : "View Feedback"}</span>
                        <ArrowUpRight size={13} />
                      </button>
                    ) : isFailed && onRetry ? (
                      <button
                        onClick={() => onRetry(sub.id)}
                        disabled={retryingId === sub.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl shadow-2xs transition-all tactile-btn cursor-pointer ml-auto focus-visible:ring-2 focus-visible:ring-rose-600/20 disabled:opacity-50"
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
                        className="px-3 py-1.5 bg-slate-100 text-slate-400 font-medium text-xs rounded-xl cursor-not-allowed border border-slate-200/60"
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
