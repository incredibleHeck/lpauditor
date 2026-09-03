"use client";

import React, { useEffect, useState, useCallback } from "react";
import { getUserSubmissions, retrySubmissionAudit } from "@/app/actions/submissions";
import { 
  FileText, CheckCircle2, RotateCcw, Search, Filter, Award 
} from "lucide-react";
import AuditDetailsModal from "./AuditDetailsModal";
import { SubmissionsTable } from "./SubmissionsTable";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { toast } from "sonner";
import type { Audit, Submission, SubmissionContext } from "@/lib/types";
import { getFileName, getAuditFromSubmission } from "@/lib/format-utils";
import { GRADE_LEVELS } from "@/lib/constants";

interface SubmissionsDashboardProps {
  initialSubmissions: Submission[];
  teacherId: string;
  refreshTrigger: number;
  teacherName?: string;
  onRequestRevision?: (sub: SubmissionContext) => void;
}

export default function SubmissionsDashboard({ 
  initialSubmissions, 
  teacherId, 
  refreshTrigger,
  teacherName = "Faculty Member",
  onRequestRevision
}: SubmissionsDashboardProps) {
  const [submissions, setSubmissions] = useState<Submission[]>(initialSubmissions);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [gradeFilter, setGradeFilter] = useState("ALL");

  const reloadSubmissions = useCallback(async () => {
    if (!teacherId) return;
    const res = await getUserSubmissions(teacherId);
    if (res.success && res.data) {
      setSubmissions(res.data as Submission[]);
    }
  }, [teacherId]);

  useEffect(() => {
    let active = true;
    const fetchFreshSubmissions = async () => {
      if (!teacherId) return;
      const res = await getUserSubmissions(teacherId);
      if (active && res.success && res.data) {
        setSubmissions(res.data as Submission[]);
      }
    };

    if (refreshTrigger > 0) {
      void fetchFreshSubmissions();
    }

    return () => {
      active = false;
    };
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
        void reloadSubmissions();
      }, 500);
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [teacherId, reloadSubmissions]);

  const handleRetry = async (submissionId: string) => {
    setRetryingId(submissionId);
    try {
      const res = await retrySubmissionAudit({ submissionId });
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
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-between border-b border-slate-200/90 pb-4">
        <div>
          <h2 className="text-base font-bold text-[#0B132B] tracking-tight">Your Curriculum Submissions</h2>
          <p className="text-xs text-slate-500 mt-0.5">Track audit status and Cambridge pedagogical feedback across weekly uploads.</p>
        </div>
        <span className="px-3 py-1 bg-slate-100 border border-slate-200 text-[#0B132B] text-xs font-bold rounded-xl font-mono tabular-nums">
          {submissions.length} Total
        </span>
      </div>

      {/* Teacher KPI Summary Cards */}
      {submissions.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Average Compliance</span>
              <p className="text-3xl font-bold font-mono text-[#0B132B] tabular-nums">{avgScore}%</p>
              <p className="text-[11px] text-slate-500">Across {completedAudits.length} audited plan(s)</p>
            </div>
            <div className="p-3 bg-slate-100 border border-slate-200 text-[#0B132B] rounded-xl shrink-0">
              <Award size={22} />
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Audited Plans</span>
              <p className="text-3xl font-bold font-mono text-emerald-800 tabular-nums">
                {completedAudits.length} <span className="text-slate-400 text-sm font-normal">/ {submissions.length}</span>
              </p>
              <p className="text-[11px] text-slate-500">Completed Cambridge evaluations</p>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl shrink-0">
              <CheckCircle2 size={22} />
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Revisions Requested</span>
              <p className={`text-3xl font-bold font-mono tabular-nums ${revisionNeededCount > 0 ? "text-amber-800" : "text-[#0B132B]"}`}>
                {revisionNeededCount}
              </p>
              <p className="text-[11px] text-slate-500">Action items flagged by HOD</p>
            </div>
            <div className={`p-3 rounded-xl border shrink-0 ${
              revisionNeededCount > 0 ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-slate-100 border-slate-200 text-slate-700"
            }`}>
              <RotateCcw size={22} />
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      {submissions.length > 0 && (
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by week, topic, or filename…"
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#0B132B]/15 focus:border-[#0B132B] bg-white text-slate-900"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1 text-xs text-slate-500 font-semibold">
              <Filter size={13} /> Filter:
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl bg-white text-slate-800 outline-none focus:ring-2 focus:ring-[#0B132B]/15 focus:border-[#0B132B] cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Audited</option>
              <option value="PENDING">Pending Queue</option>
              <option value="REVISION">Revision Requested</option>
              <option value="FAILED">Failed</option>
            </select>

            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl bg-white text-slate-800 outline-none focus:ring-2 focus:ring-[#0B132B]/15 focus:border-[#0B132B] cursor-pointer"
            >
              <option value="ALL">All Grades</option>
              {GRADE_LEVELS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>
      )}

      {submissions.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-200 bg-white rounded-2xl shadow-2xs space-y-2">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl mx-auto flex items-center justify-center text-slate-400">
            <FileText size={22} />
          </div>
          <h3 className="text-xs font-bold text-slate-800">No lesson plan submissions yet</h3>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            Upload your weekly document using the submission card above to receive structured Cambridge feedback.
          </p>
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-slate-200 bg-white rounded-2xl shadow-2xs space-y-1.5">
          <div className="w-10 h-10 bg-slate-100 rounded-xl mx-auto flex items-center justify-center text-slate-400">
            <Search size={18} />
          </div>
          <h3 className="text-xs font-bold text-slate-800">No matching submissions found</h3>
          <p className="text-[11px] text-slate-400">Try adjusting your search query or filter options.</p>
        </div>
      ) : (
        <SubmissionsTable
          submissions={filteredSubmissions}
          showTeacherColumn={false}
          onViewAudit={handleViewAudit}
          onRetry={handleRetry}
          retryingId={retryingId}
        />
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
        teacherName={teacherName}
        onDecisionUpdated={() => reloadSubmissions()}
        onRequestRevision={onRequestRevision}
      />
    </div>
  );
}
