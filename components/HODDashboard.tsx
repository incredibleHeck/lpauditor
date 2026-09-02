"use client";

import React, { useEffect, useState, useCallback } from "react";
import { getDepartmentSubmissions } from "@/app/actions/submissions";
import { getDepartmentAnalytics } from "@/app/actions/ai";
import { getDefaultersReportAction, triggerTelegramDefaulterReportAction } from "@/app/actions/notifications";
import { 
  FileText, Sparkles, Download, RefreshCw, Search, Filter
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { toast } from "sonner";
import { DefaulterReportData } from "@/lib/telegram";
import DepartmentKPIs from "./hod/DepartmentKPIs";
import DefaultersPanel from "./hod/DefaultersPanel";
import { SubmissionsTable } from "./SubmissionsTable";
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
  const [selectedWeek, setSelectedWeek] = useState<string>("Week 1");
  const [defaulterReport, setDefaulterReport] = useState<DefaulterReportData | null>(null);
  const [loadingDefaulters, setLoadingDefaulters] = useState(true);
  const [dispatchingTelegram, setDispatchingTelegram] = useState(false);

  const fetchDefaulters = useCallback(async (deptToUse = selectedDepartment, weekToUse = selectedWeek) => {
    setLoadingDefaulters(true);
    const res = await getDefaultersReportAction(weekToUse, deptToUse);
    if (res.success && res.data) {
      setDefaulterReport(res.data);
    }
    setLoadingDefaulters(false);
  }, [selectedDepartment, selectedWeek]);

  const handleSendTelegramAlert = async () => {
    setDispatchingTelegram(true);
    const res = await triggerTelegramDefaulterReportAction(selectedWeek, selectedDepartment);
    if (res.success) {
      if (res.telegramResult?.success) {
        toast.success("Telegram defaulters report successfully sent to administrators!");
      } else {
        toast.warning(
          res.telegramResult?.error || 
          "Defaulters report compiled, but Telegram dispatch skipped (check TELEGRAM_BOT_TOKEN)."
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
      const defRes = await getDefaultersReportAction(selectedWeek, selectedDepartment);
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
  }, [selectedDepartment, selectedWeek, refreshTrigger]);

  const reloadSubmissions = useCallback(async () => {
    if (!department) return;
    const res = await getDepartmentSubmissions(department);
    if (res.success && res.data) {
      setSubmissions(res.data as Submission[]);
    }
  }, [department]);

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
        void reloadSubmissions();
      }, 500);
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [department, reloadSubmissions]);

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
      const teacher = sub.profiles?.full_name || "Faculty Member";
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
    link.setAttribute("download", `${selectedDepartment.replace(/\s+/g, "_")}_Compliance_Report.csv`);
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
    const teacherName = sub.profiles?.full_name || "Faculty Member";
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
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200/80 pb-4 gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            {selectedDepartment === "All Departments" ? "School-Wide Compliance" : `${selectedDepartment} Department`}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit results, pedagogical trends, and weekly submission oversight across St. Adelaide International School.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-900 text-xs font-semibold rounded-lg shadow-2xs outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 cursor-pointer"
          >
            <option value="All Departments">All Departments (School-Wide)</option>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-2xs transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-900/20 active:scale-[0.99]"
          >
            <Download size={13} /> Export CSV
          </button>
          <span className="px-2.5 py-1.5 bg-slate-100 border border-slate-200 text-slate-700 text-xs font-mono font-semibold rounded-lg">
            {submissions.length} Total
          </span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <DepartmentKPIs stats={analytics?.stats} loading={loadingAnalytics} />

      {/* AI Weekly Executive Briefing Panel */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-100 text-slate-800 rounded-xl">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Department Pedagogical Synthesis</h3>
              <p className="text-[11px] text-slate-400">Automated Gemini 3.6 compliance analysis of weekly trends</p>
            </div>
          </div>
          <button
            onClick={() => fetchAnalytics()}
            disabled={loadingAnalytics}
            className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg shadow-2xs cursor-pointer transition-all disabled:opacity-50"
          >
            <RefreshCw size={12} className={loadingAnalytics ? "animate-spin" : ""} /> Refresh Briefing
          </button>
        </div>
        
        {loadingAnalytics ? (
          <div className="space-y-2 py-2 animate-pulse">
            <div className="h-3.5 bg-slate-100 rounded w-full"></div>
            <div className="h-3.5 bg-slate-100 rounded w-4/5"></div>
          </div>
        ) : (
          <p className="text-xs text-slate-700 leading-relaxed font-normal bg-slate-50 p-4 rounded-xl border border-slate-200/60">
            {analytics?.brief || "No departmental compliance trends detected yet for this selection."}
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
        selectedWeek={selectedWeek}
        onWeekChange={(week) => {
          setSelectedWeek(week);
          fetchDefaulters(selectedDepartment, week);
        }}
      />

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by faculty name, week, or lesson topic…"
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 bg-white"
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center">
          <div className="flex items-center gap-1 text-xs text-slate-500 font-semibold">
            <Filter size={13} /> Filter:
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 cursor-pointer"
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
            className="px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 cursor-pointer"
          >
            <option value="ALL">All Grades</option>
            {GRADE_LEVELS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>

      {filteredSubmissions.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-200 bg-white rounded-2xl shadow-2xs space-y-2">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl mx-auto flex items-center justify-center text-slate-400">
            <FileText size={22} />
          </div>
          <h3 className="text-xs font-bold text-slate-800">No matching department submissions found</h3>
          <p className="text-[11px] text-slate-400">Try adjusting your search criteria or department filter.</p>
        </div>
      ) : (
        <SubmissionsTable
          submissions={filteredSubmissions}
          showTeacherColumn={true}
          onViewAudit={handleViewAudit}
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
        userRole="HOD"
        teacherName={selectedSubmission?.profiles?.full_name || "Faculty Member"}
        onDecisionUpdated={() => reloadSubmissions()}
      />
    </div>
  );
}
