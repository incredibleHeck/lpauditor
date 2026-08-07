"use client";

import React, { useEffect, useState } from "react";
import { getUserSubmissions, retrySubmissionAudit } from "@/app/actions/submissions";
import { 
  FileText, Loader2, CheckCircle, AlertTriangle, Clock, Calendar, Check, 
  RotateCcw, UserCheck, Search, Filter, Award, RefreshCw 
} from "lucide-react";
import AuditDetailsModal from "./AuditDetailsModal";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { toast } from "sonner";
import type { Audit, Submission } from "@/lib/types";
import { getFileName, formatDate, getAuditFromSubmission } from "@/lib/format-utils";
import { GRADE_LEVELS } from "@/lib/constants";


interface SubmissionsDashboardProps {
  initialSubmissions: Submission[];
  teacherId: string;
  refreshTrigger: number;
}

export default function SubmissionsDashboard({ initialSubmissions, teacherId, refreshTrigger }: SubmissionsDashboardProps) {
  const [submissions, setSubmissions] = useState<Submission[]>(initialSubmissions);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [prevInitialSubmissions, setPrevInitialSubmissions] = useState(initialSubmissions);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [gradeFilter, setGradeFilter] = useState("ALL");

  useEffect(() => {
    setSubmissions(initialSubmissions);
  }, [initialSubmissions]);

  const reloadSubmissions = async () => {
    if (!teacherId) return;
    const res = await getUserSubmissions(teacherId);
    if (res.success && res.data) {
      setSubmissions(res.data as Submission[]);
    }
  };

  useEffect(() => {
    if (refreshTrigger > 0) {
      reloadSubmissions();
    }
  }, [refreshTrigger, teacherId]);

  // Realtime Cloud Firestore listener
  useEffect(() => {
    if (!teacherId) return;

    const q = query(
      collection(db, "submissions"),
      where("teacher_id", "==", teacherId)
    );

    let timer: NodeJS.Timeout;
    const unsubscribe = onSnapshot(q, () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        reloadSubmissions();
      }, 500);
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [teacherId]);

  const handleRetry = async (submissionId: string) => {
    setRetryingId(submissionId);
    try {
      const res = await retrySubmissionAudit(submissionId);
      if (res.success) {
        toast.success("Audit process re-triggered successfully!");
        await reloadSubmissions();
      } else {
        toast.error(res.error || "Failed to retry audit.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error retrying audit.");
    } finally {
      setRetryingId(null);
    }
  };

  const handleViewAudit = (sub: Submission) => {
    const auditObj = getAuditFromSubmission(sub);
    if (auditObj) {
      setSelectedSubmission(sub);
      setSelectedAudit(auditObj);
      setIsModalOpen(true);
    }
  };



  // Compute Teacher Statistics
  const completedAudits = submissions
    .map((sub) => getAuditFromSubmission(sub))
    .filter((a): a is Audit => a !== null && typeof a.score === "number");

  const avgScore = completedAudits.length > 0
    ? Math.round(completedAudits.reduce((acc, curr) => acc + (curr?.score || 0), 0) / completedAudits.length)
    : 0;

  const revisionNeededCount = submissions.filter((s) => s.hod_decision === "REVISION_REQUESTED").length;

  // Filter Submissions
  const filteredSubmissions = submissions.filter((sub) => {
    const filename = getFileName(sub.file_url);
    const matchesSearch = 
      filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.week_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.subject.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesGrade = gradeFilter === "ALL" || sub.grade_level === gradeFilter;

    let matchesStatus = true;
    if (statusFilter === "COMPLETED") matchesStatus = sub.status === "COMPLETED";
    else if (statusFilter === "PENDING") matchesStatus = sub.status === "PENDING" || sub.status === "PROCESSING";
    else if (statusFilter === "REVISION") matchesStatus = sub.hod_decision === "REVISION_REQUESTED";
    else if (statusFilter === "FAILED") matchesStatus = sub.status === "FAILED";

    return matchesSearch && matchesGrade && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">Your Audit Submissions</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Track and view compliance results for weekly uploads.</p>
        </div>
        <span className="px-2.5 py-1 bg-zinc-100 border border-zinc-200 text-zinc-800 text-xs font-bold rounded-lg uppercase tracking-wide">
          {submissions.length} Total
        </span>
      </div>

      {/* Teacher KPI Summary Cards */}
      {submissions.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Average Score</span>
              <p className="text-2xl font-black text-zinc-900">{avgScore}%</p>
              <p className="text-[11px] text-zinc-500">Across {completedAudits.length} audited plan(s)</p>
            </div>
            <div className="p-2.5 bg-amber-50 border border-amber-100 text-amber-600 rounded-xl">
              <Award size={22} />
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Audited / Total</span>
              <p className="text-2xl font-black text-emerald-600">
                {completedAudits.length} <span className="text-zinc-400 text-base font-normal">/ {submissions.length}</span>
              </p>
              <p className="text-[11px] text-zinc-500">Completed Cambridge audits</p>
            </div>
            <div className="p-2.5 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl">
              <CheckCircle size={22} />
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Revisions Requested</span>
              <p className={`text-2xl font-black ${revisionNeededCount > 0 ? "text-amber-600" : "text-zinc-900"}`}>
                {revisionNeededCount}
              </p>
              <p className="text-[11px] text-zinc-500">Flagged for HOD revision</p>
            </div>
            <div className="p-2.5 bg-zinc-50 border border-zinc-200 text-zinc-600 rounded-xl">
              <RotateCcw size={22} />
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      {submissions.length > 0 && (
        <div className="bg-white p-3.5 rounded-xl border border-zinc-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by week, topic, filename..."
              className="w-full pl-9 pr-4 py-1.5 text-xs border border-zinc-200 rounded-lg outline-none focus:ring-1 focus:ring-amber-500 bg-zinc-50/50"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1 text-xs text-zinc-500 font-bold">
              <Filter size={13} /> Filter:
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-semibold border border-zinc-200 rounded-lg bg-zinc-50/50 outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Audited</option>
              <option value="PENDING">Pending</option>
              <option value="REVISION">Revision Requested</option>
              <option value="FAILED">Failed</option>
            </select>

            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-semibold border border-zinc-200 rounded-lg bg-zinc-50/50 outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="ALL">All Grades</option>
              {GRADE_LEVELS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>
      )}

      {submissions.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-zinc-200 bg-white rounded-xl shadow-xs">
          <FileText className="mx-auto h-12 w-12 text-zinc-300 mb-3" />
          <h3 className="text-sm font-bold text-zinc-700">No submissions yet</h3>
          <p className="text-xs text-zinc-400 mt-1">Upload a lesson plan document above to initiate your first audit.</p>
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-zinc-200 bg-white rounded-xl shadow-xs">
          <FileText className="mx-auto h-10 w-10 text-zinc-300 mb-2" />
          <h3 className="text-sm font-bold text-zinc-700">No matching submissions found</h3>
          <p className="text-xs text-zinc-400 mt-1">Try clearing your search query or filter options.</p>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-left">
              <thead className="bg-zinc-50/70 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Lesson Plan</th>
                  <th className="px-6 py-4">Subject</th>
                  <th className="px-6 py-4">Week / Grade</th>
                  <th className="px-6 py-4">Audit Status</th>
                  <th className="px-6 py-4">HOD Review</th>
                  <th className="px-6 py-4">Compliance</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-sm font-medium text-zinc-700">
                {filteredSubmissions.map((sub) => {
                  const filename = getFileName(sub.file_url);
                  const isPending = sub.status === "PENDING";
                  const isProcessing = sub.status === "PROCESSING";
                  const isCompleted = sub.status === "COMPLETED";
                  const isFailed = sub.status === "FAILED";

                  const rawAudit = sub.ai_audits;
                  const audit = getAuditFromSubmission(sub);
                  const score = audit?.score;

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

                      <td className="px-6 py-4.5 align-middle">
                        <span className="text-zinc-600">{sub.subject}</span>
                      </td>

                      <td className="px-6 py-4.5 align-middle">
                        <div className="space-y-0.5">
                          <p className="text-zinc-700 font-semibold">{sub.week_name}</p>
                          <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider">{sub.grade_level}</p>
                        </div>
                      </td>

                      <td className="px-6 py-4.5 align-middle">
                        {isPending && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-700 text-xs font-bold rounded-lg">
                            <Clock size={13} /> Pending Queue
                          </span>
                        )}
                        {isProcessing && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-700 text-xs font-bold rounded-lg animate-pulse">
                            <Loader2 className="animate-spin" size={13} /> Analyzing...
                          </span>
                        )}
                        {isCompleted && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/20 text-green-700 text-xs font-bold rounded-lg">
                            <CheckCircle size={13} /> Audit Complete
                          </span>
                        )}
                        {isFailed && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/20 text-red-700 text-xs font-bold rounded-lg">
                            <AlertTriangle size={13} /> Audit Failed
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4.5 align-middle">
                        {sub.hod_decision === "APPROVED" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-lg">
                            <Check size={13} /> Approved
                          </span>
                        )}
                        {sub.hod_decision === "REVISION_REQUESTED" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-lg">
                            <RotateCcw size={13} /> Revision Needed
                          </span>
                        )}
                        {sub.hod_decision === "NEEDS_OBSERVATION" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold rounded-lg">
                            <UserCheck size={13} /> Observation
                          </span>
                        )}
                        {!sub.hod_decision && (
                          <span className="text-xs text-zinc-400 italic">Pending HOD Review</span>
                        )}
                      </td>

                      <td className="px-6 py-4.5 align-middle">
                        {isCompleted && score !== undefined && score !== null ? (
                          <div className="flex items-center gap-2">
                            <span className={`text-base font-extrabold ${
                              score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-red-600"
                            }`}>
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
                        ) : isFailed ? (
                          <span className="text-xs text-red-400 font-semibold">Auditor Error</span>
                        ) : (
                          <span className="text-xs text-zinc-400 italic">Awaiting analysis</span>
                        )}
                      </td>

                      <td className="px-6 py-4.5 align-middle text-right">
                        {isCompleted && audit ? (
                          <button
                            onClick={() => handleViewAudit(sub)}
                            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-lg shadow-xs transition-all cursor-pointer"
                          >
                            Review Feedback
                          </button>
                        ) : isFailed ? (
                          <button
                            onClick={() => handleRetry(sub.id)}
                            disabled={retryingId === sub.id}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg shadow-xs transition-all flex items-center gap-1 cursor-pointer ml-auto"
                          >
                            {retryingId === sub.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
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
      )}

      <AuditDetailsModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedSubmission(null);
          setSelectedAudit(null);
        }}
        audit={selectedAudit}
        submission={selectedSubmission}
        fileName={selectedSubmission ? getFileName(selectedSubmission.file_url) : ""}
        userRole="TEACHER"
        onDecisionUpdated={() => reloadSubmissions()}
      />
    </div>
  );
}
