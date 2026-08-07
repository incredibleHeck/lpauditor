"use client";

import React, { useEffect, useState, useCallback } from "react";
import { getDepartmentSubmissions } from "@/app/actions/submissions";
import { getDepartmentAnalytics } from "@/app/actions/ai";
import { getDefaultersReportAction, triggerTelegramDefaulterReportAction } from "@/app/actions/notifications";
import { 
  FileText, Loader2, CheckCircle, AlertTriangle, Clock, Calendar, Sparkles, 
  Users, ShieldAlert, Award, Search, Filter, Check, RotateCcw, UserCheck,
  Download, RefreshCw, Send, UserX, CalendarClock
} from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { toast } from "sonner";
import { DefaulterReportData } from "@/lib/telegram";
import DepartmentKPIs from "./hod/DepartmentKPIs";
import DefaultersPanel from "./hod/DefaultersPanel";
import AuditDetailsModal from "./AuditDetailsModal";
import type { Audit, Submission } from "@/lib/types";
import { getFileName, formatDate, getAuditFromSubmission } from "@/lib/format-utils";
import { DEPARTMENTS, GRADE_LEVELS } from "@/lib/constants";


interface HODDashboardProps {
  initialSubmissions: Submission[];
  department: string;
  refreshTrigger?: number;
}

export default function HODDashboard({ initialSubmissions, department, refreshTrigger = 0 }: HODDashboardProps) {
  const [submissions, setSubmissions] = useState<Submission[]>(initialSubmissions);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [prevInitialSubmissions, setPrevInitialSubmissions] = useState(initialSubmissions);

  const [selectedDepartment, setSelectedDepartment] = useState(
    department === "Administration" || !department ? "All Departments" : department
  );

  // Search & Filtering States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [gradeFilter, setGradeFilter] = useState("ALL");

  const [analytics, setAnalytics] = useState<{
    stats: {
      totalCount: number;
      completedCount: number;
      pendingCount: number;
      failedCount: number;
      averageScore: number;
      underperformingCount: number;
      commonFlags: string[];
    };
    brief: string;
  } | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  // Defaulters & Telegram Reporting States
  const [defaulterReport, setDefaulterReport] = useState<DefaulterReportData | null>(null);
  const [loadingDefaulters, setLoadingDefaulters] = useState(true);
  const [dispatchingTelegram, setDispatchingTelegram] = useState(false);

  const fetchDefaulters = useCallback(async (deptToUse = selectedDepartment) => {
    setLoadingDefaulters(true);
    const res = await getDefaultersReportAction(undefined, deptToUse);
    if (res.success && res.data) {
      setDefaulterReport(res.data);
    }
    setLoadingDefaulters(false);
  }, [selectedDepartment]);

  const handleSendTelegramAlert = async () => {
    setDispatchingTelegram(true);
    const res = await triggerTelegramDefaulterReportAction(undefined, selectedDepartment);
    if (res.success) {
      if (res.telegramResult?.success) {
        toast.success("Telegram defaulters report successfully sent to administrators!");
      } else {
        toast.warning(
          res.telegramResult?.error || 
          "Defaulters report compiled, but Telegram message skipped (check TELEGRAM_BOT_TOKEN)."
        );
      }
    } else {
      toast.error(res.error || "Failed to dispatch Telegram report.");
    }
    setDispatchingTelegram(false);
  };

  const fetchAnalytics = useCallback(async (deptToUse = selectedDepartment) => {
    setLoadingAnalytics(true);
    const res = await getDepartmentAnalytics(deptToUse);
    if (res.success && res.stats) {
      setAnalytics({
        stats: res.stats,
        brief: res.brief || ""
      });
    }
    setLoadingAnalytics(false);
  }, [selectedDepartment]);

  useEffect(() => {
    let active = true;
    const runFetch = async () => {
      setLoadingAnalytics(true);
      setLoadingDefaulters(true);
      const res = await getDepartmentAnalytics(selectedDepartment);
      const defRes = await getDefaultersReportAction(undefined, selectedDepartment);
      const subRes = await getDepartmentSubmissions(selectedDepartment);

      if (active && res.success && res.stats) {
        setAnalytics({
          stats: res.stats,
          brief: res.brief || ""
        });
      }
      if (active && defRes.success && defRes.data) {
        setDefaulterReport(defRes.data);
      }
      if (active && subRes.success && subRes.data) {
        setSubmissions(subRes.data as Submission[]);
      }
      if (active) {
        setLoadingAnalytics(false);
        setLoadingDefaulters(false);
      }
    };
    runFetch();
    return () => {
      active = false;
    };
  }, [selectedDepartment, refreshTrigger]);

  useEffect(() => {
    setSubmissions(initialSubmissions);
  }, [initialSubmissions]);

  const reloadSubmissions = useCallback(async () => {
    if (!department) return;
    const res = await getDepartmentSubmissions(department);
    if (res.success && res.data) {
      setSubmissions(res.data as Submission[]);
    }
  }, [department]);

  useEffect(() => {
    if (refreshTrigger > 0) {
      reloadSubmissions();
    }
  }, [refreshTrigger, department]);

  // Realtime Cloud Firestore listener for department
  useEffect(() => {
    if (!department) return;

    const q = query(
      collection(db, "submissions"),
      where("subject", "==", department)
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
  }, [department]);

  const exportToCSV = () => {
    if (submissions.length === 0) {
      toast.info("No submissions to export.");
      return;
    }

    const sanitizeCSVField = (val: string) => {
      return `"${(val || "").replace(/[\r\n]+/g, " ").replace(/"/g, '""')}"`;
    };

    const headers = ["Teacher Name", "Subject", "Grade Level", "Week", "Audit Status", "HOD Decision", "Compliance Score %", "Submitted Date"];
    const rows = filteredSubmissions.map((sub) => {
      const audit = getAuditFromSubmission(sub);
      const score = audit?.score !== undefined && audit?.score !== null ? `${audit.score}%` : "N/A";
      const teacher = sub.profiles?.full_name || "Teacher";
      const decision = sub.hod_decision || "Pending Review";
      const created = formatDate(sub.created_at);

      return [
        sanitizeCSVField(teacher),
        sanitizeCSVField(sub.subject),
        sanitizeCSVField(sub.grade_level),
        sanitizeCSVField(sub.week_name),
        sanitizeCSVField(sub.status || ""),
        sanitizeCSVField(decision),
        sanitizeCSVField(score),
        sanitizeCSVField(created)
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${department.replace(/\s+/g, "_")}_Compliance_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Department CSV compliance report downloaded!");
  };

  const handleViewAudit = (sub: Submission) => {
    const auditObj = getAuditFromSubmission(sub);
    if (auditObj) {
      setSelectedSubmission(sub);
      setSelectedAudit(auditObj);
      setIsModalOpen(true);
    }
  };



  // Filtered Submissions Logic
  const filteredSubmissions = submissions.filter((sub) => {
    const teacherName = sub.profiles?.full_name || "Teacher";
    const filename = getFileName(sub.file_url);
    const matchesSearch = 
      teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.week_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.subject.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesGrade = gradeFilter === "ALL" || sub.grade_level === gradeFilter;

    let matchesStatus = true;
    if (statusFilter === "PENDING") matchesStatus = sub.status === "PENDING" || sub.status === "PROCESSING";
    else if (statusFilter === "COMPLETED") matchesStatus = sub.status === "COMPLETED";
    else if (statusFilter === "FAILED") matchesStatus = sub.status === "FAILED";
    else if (statusFilter === "APPROVED") matchesStatus = sub.hod_decision === "APPROVED";
    else if (statusFilter === "REVISION_REQUESTED") matchesStatus = sub.hod_decision === "REVISION_REQUESTED";
    else if (statusFilter === "NEEDS_OBSERVATION") matchesStatus = sub.hod_decision === "NEEDS_OBSERVATION";

    return matchesSearch && matchesGrade && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-200 pb-4 gap-3">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">
            {selectedDepartment === "All Departments" ? "School-Wide" : selectedDepartment} Compliance & Defaulters
          </h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Track, audit, and review lesson plans and defaulters across St. Adelaide International School.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="px-3 py-1.5 bg-white border border-zinc-300 hover:border-zinc-400 text-zinc-800 text-xs font-bold rounded-lg shadow-2xs outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
          >
            <option value="All Departments">All Departments (School-Wide)</option>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-lg shadow-xs transition-all cursor-pointer"
          >
            <Download size={14} /> Export CSV Report
          </button>
          <span className="px-2.5 py-1.5 bg-zinc-100 border border-zinc-200 text-zinc-800 text-xs font-bold rounded-lg uppercase tracking-wide">
            {submissions.length} Total
          </span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <DepartmentKPIs stats={analytics?.stats} loading={loadingAnalytics} />

      {/* AI Weekly Briefing Panel */}
      <div className="relative overflow-hidden bg-gradient-to-r from-amber-500/5 via-amber-600/[0.02] to-transparent border border-amber-500/20 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-600">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900">Department AI Weekly Briefing</h3>
              <p className="text-xs text-zinc-500">Gemini 3.6 Flash synthesis of compliance trends</p>
            </div>
          </div>
          <button
            onClick={() => fetchAnalytics()}
            disabled={loadingAnalytics}
            className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 font-bold text-xs rounded-lg shadow-xs cursor-pointer transition-all disabled:opacity-50"
          >
            <RefreshCw size={13} className={loadingAnalytics ? "animate-spin" : ""} /> Refresh Briefing
          </button>
        </div>
        
        {loadingAnalytics ? (
          <div className="space-y-2 py-1 animate-pulse">
            <div className="h-4 bg-zinc-200/60 rounded w-full"></div>
            <div className="h-4 bg-zinc-200/60 rounded w-5/6"></div>
          </div>
        ) : (
          <p className="text-sm text-zinc-700 leading-relaxed font-normal">
            {analytics?.brief}
          </p>
        )}
      </div>

      {/* Submission Deadline & Telegram Defaulter Alerts Panel */}
      <DefaultersPanel
        report={defaulterReport}
        loading={loadingDefaulters}
        onRefresh={() => fetchDefaulters()}
        onSendAlert={handleSendTelegramAlert}
        isDispatching={dispatchingTelegram}
      />

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by teacher name, week, topic..."
            className="w-full pl-9 pr-4 py-2 text-xs border border-zinc-200 rounded-lg outline-none focus:ring-1 focus:ring-amber-500 bg-zinc-50/50"
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-bold">
            <Filter size={14} /> Filter:
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold border border-zinc-200 rounded-lg bg-zinc-50/50 outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="ALL">All Audit Statuses</option>
            <option value="COMPLETED">Audited</option>
            <option value="PENDING">Pending Queue</option>
            <option value="APPROVED">Approved by HOD</option>
            <option value="REVISION_REQUESTED">Revision Requested</option>
            <option value="NEEDS_OBSERVATION">Peer Observation</option>
            <option value="FAILED">Failed</option>
          </select>

          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold border border-zinc-200 rounded-lg bg-zinc-50/50 outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="ALL">All Grades</option>
            {GRADE_LEVELS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>

      {filteredSubmissions.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-zinc-200 bg-white rounded-xl shadow-xs">
          <FileText className="mx-auto h-12 w-12 text-zinc-300 mb-3" />
          <h3 className="text-sm font-bold text-zinc-700">No matching submissions found</h3>
          <p className="text-xs text-zinc-400 mt-1">Try adjusting your search terms or filter selections.</p>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-left">
              <thead className="bg-zinc-50/70 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Lesson Plan</th>
                  <th className="px-6 py-4">Teacher</th>
                  <th className="px-6 py-4">Subject</th>
                  <th className="px-6 py-4">Week / Grade</th>
                  <th className="px-6 py-4">Audit Status</th>
                  <th className="px-6 py-4">HOD Decision</th>
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
                        <span className="text-zinc-900 font-bold">{sub.profiles?.full_name || "Teacher"}</span>
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
                        <div className="flex items-center justify-end gap-2">
                          {isCompleted && audit ? (
                            <button
                              onClick={() => handleViewAudit(sub)}
                              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-lg shadow-xs transition-all cursor-pointer"
                            >
                              Review & Audit
                            </button>
                          ) : (
                            <button
                              disabled
                              className="px-3 py-1.5 bg-zinc-100 text-zinc-400 border border-zinc-200 font-bold text-xs rounded-lg cursor-not-allowed"
                            >
                              Feedback Locked
                            </button>
                          )}
                        </div>
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
        userRole="HOD"
        onDecisionUpdated={() => reloadSubmissions()}
      />
    </div>
  );
}
