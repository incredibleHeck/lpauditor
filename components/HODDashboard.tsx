"use client";

import React, { useEffect, useState } from "react";
import { getDepartmentSubmissions, getDepartmentAnalytics } from "@/app/actions/submissions";
import { FileText, Loader2, CheckCircle, AlertTriangle, Clock, Calendar, Sparkles, Users, ShieldAlert, Award } from "lucide-react";
import AuditDetailsModal from "./AuditDetailsModal";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

interface Audit {
  id: string;
  submission_id: string;
  score: number | null;
  lessons_detected: number | null;
  strengths: string[];
  flags: string[];
  raw_response: Record<string, unknown>;
  created_at: string;
}

interface Submission {
  id: string;
  teacher_id: string;
  file_url: string;
  subject: string;
  week_name: string;
  grade_level: string;
  status: string | null;
  created_at: string;
  ai_audits: Audit[] | Audit | null;
  profiles?: { full_name: string; department: string };
}

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

  useEffect(() => {
    let active = true;
    const fetchAnalytics = async () => {
      setLoadingAnalytics(true);
      const res = await getDepartmentAnalytics(department);
      if (active && res.success && res.stats) {
        setAnalytics({
          stats: res.stats,
          brief: res.brief || ""
        });
      }
      if (active) {
        setLoadingAnalytics(false);
      }
    };
    fetchAnalytics();
    return () => {
      active = false;
    };
  }, [department, submissions]);

  if (initialSubmissions !== prevInitialSubmissions) {
    setPrevInitialSubmissions(initialSubmissions);
    setSubmissions(initialSubmissions);
  }

  const reloadSubmissions = async () => {
    if (!department) return;
    const res = await getDepartmentSubmissions(department);
    if (res.success && res.data) {
      setSubmissions(res.data as Submission[]);
    }
  };

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

    const unsubscribe = onSnapshot(q, async () => {
      await reloadSubmissions();
    });

    return () => unsubscribe();
  }, [department]);

  const handleViewAudit = (sub: Submission) => {
    const rawAudit = sub.ai_audits;
    let auditObj: Audit | null = null;
    
    if (Array.isArray(rawAudit)) {
      auditObj = rawAudit.length > 0 ? rawAudit[0] : null;
    } else {
      auditObj = rawAudit;
    }

    if (auditObj) {
      setSelectedSubmission(sub);
      setSelectedAudit(auditObj);
      setIsModalOpen(true);
    }
  };

  const getFileName = (url: string) => {
    try {
      const parts = url.split("/");
      const rawName = parts[parts.length - 1];
      const cleanParts = rawName.split("_");
      if (cleanParts.length > 1) {
        return cleanParts.slice(1).join("_");
      }
      return rawName;
    } catch {
      return "Document.pdf";
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return "Recent";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900">{department} Department Submissions</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Track and view compliance results for all teachers in your department.</p>
        </div>
        <span className="px-2.5 py-1 bg-zinc-100 border border-zinc-200 text-zinc-800 text-xs font-bold rounded-lg uppercase tracking-wide">
          {submissions.length} Total
        </span>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Average Compliance</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-zinc-900">
                {loadingAnalytics ? "..." : `${analytics?.stats.averageScore || 0}%`}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">Across all completed lesson plans</p>
          </div>
          <div className={`p-3 rounded-xl border shrink-0 ${
            (analytics?.stats.averageScore || 0) >= 80 ? "bg-emerald-50 border-emerald-100 text-emerald-600" :
            (analytics?.stats.averageScore || 0) >= 50 ? "bg-amber-50 border-amber-100 text-amber-600" :
            "bg-red-50 border-red-100 text-red-600"
          }`}>
            <Award size={24} />
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Submission Status</span>
            <div className="text-sm font-semibold text-zinc-700 flex flex-wrap gap-x-3 gap-y-1 mt-1">
              <span className="text-green-600">{analytics?.stats.completedCount || 0} Audited</span>
              <span className="text-amber-600">{analytics?.stats.pendingCount || 0} Pending</span>
              {analytics?.stats.failedCount ? <span className="text-red-500">{analytics?.stats.failedCount} Failed</span> : null}
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">Total: {analytics?.stats.totalCount || 0} uploads</p>
          </div>
          <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-zinc-600 shrink-0">
            <Users size={24} />
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Critical Reviews</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-red-600">
                {loadingAnalytics ? "..." : analytics?.stats.underperformingCount || 0}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">Scored under 50% threshold</p>
          </div>
          <div className={`p-3 rounded-xl border shrink-0 ${
            (analytics?.stats.underperformingCount || 0) > 0 ? "bg-red-50 border-red-100 text-red-600 animate-pulse" : "bg-zinc-50 border-zinc-100 text-zinc-400"
          }`}>
            <ShieldAlert size={24} />
          </div>
        </div>
      </div>

      {/* AI Weekly Briefing Panel */}
      <div className="relative overflow-hidden bg-gradient-to-r from-amber-500/5 via-amber-600/[0.02] to-transparent border border-amber-500/20 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-600">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900">Department AI Weekly Briefing</h3>
            <p className="text-xs text-zinc-500">Gemini 3.6 Flash synthesis of compliance trends</p>
          </div>
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

      {submissions.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-zinc-200 bg-white rounded-xl shadow-sm">
          <FileText className="mx-auto h-12 w-12 text-zinc-300 mb-3" />
          <h3 className="text-sm font-bold text-zinc-700">No submissions yet</h3>
          <p className="text-xs text-zinc-400 mt-1">Upload a lesson plan document above to initiate your first audit.</p>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-left">
              <thead className="bg-zinc-50/70 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Lesson Plan</th>
                  <th className="px-6 py-4">Teacher</th>
                  <th className="px-6 py-4">Subject</th>
                  <th className="px-6 py-4">Week / Grade</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Compliance</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-sm font-medium text-zinc-700">
                {submissions.map((sub) => {
                  const filename = getFileName(sub.file_url);
                  const isPending = sub.status === "PENDING";
                  const isProcessing = sub.status === "PROCESSING";
                  const isCompleted = sub.status === "COMPLETED";
                  const isFailed = sub.status === "FAILED";

                  const rawAudit = sub.ai_audits;
                  const audit = Array.isArray(rawAudit) ? rawAudit[0] : rawAudit;
                  const score = audit?.score;

                  return (
                    <tr key={sub.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-6 py-4.5">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-amber-50 rounded-lg text-amber-600 border border-amber-100 shrink-0">
                            <FileText size={18} />
                          </div>
                          <div className="max-w-[200px] sm:max-w-xs overflow-hidden">
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
                        <span className="text-zinc-900 font-medium">{sub.profiles?.full_name || "Teacher"}</span>
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
                            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer"
                          >
                            Review Feedback
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
        fileName={selectedSubmission ? getFileName(selectedSubmission.file_url) : ""}
      />
    </div>
  );
}
