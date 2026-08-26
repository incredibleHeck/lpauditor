import React from "react";
import { DefaulterReportData } from "@/lib/telegram";
import { CalendarClock, RefreshCw, Send, Loader2, UserX, CheckCircle2 } from "lucide-react";

interface DefaultersPanelProps {
  report: DefaulterReportData | null;
  loading: boolean;
  onRefresh: () => void;
  onSendAlert: () => void;
  isDispatching: boolean;
}

export default function DefaultersPanel({
  report,
  loading,
  onRefresh,
  onSendAlert,
  isDispatching
}: DefaultersPanelProps) {
  const complianceRate = report && report.totalTeachers > 0
    ? Math.round((report.submittedCount / report.totalTeachers) * 100)
    : 100;

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-100 border border-slate-200/70 rounded-xl text-slate-800">
            <CalendarClock size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Submission Deadlines & Defaulter Tracking</h3>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-mono font-semibold rounded-md uppercase">
                {report?.weekName || "Current Week"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Weekly Target Deadline: <span className="font-semibold text-slate-800">{report?.deadlineDate || "Friday 17:00"}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh Defaulters
          </button>

          <button
            onClick={onSendAlert}
            disabled={isDispatching}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-slate-900/20 active:scale-[0.99]"
          >
            {isDispatching ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Send size={13} />
            )}
            <span>{isDispatching ? "Dispatching…" : "Dispatch Telegram Alert"}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-4 space-y-2 animate-pulse">
          <div className="h-4 bg-slate-100 rounded w-1/3"></div>
          <div className="h-8 bg-slate-100 rounded w-full"></div>
        </div>
      ) : report ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5 space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Faculty</span>
              <span className="text-xl font-bold font-mono text-slate-900">{report.totalTeachers}</span>
            </div>
            <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3.5 space-y-0.5">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Submitted</span>
              <span className="text-xl font-bold font-mono text-emerald-800">{report.submittedCount}</span>
            </div>
            <div className="bg-rose-50/70 border border-rose-100 rounded-xl p-3.5 space-y-0.5">
              <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">Pending Defaulters</span>
              <span className="text-xl font-bold font-mono text-rose-800">{report.defaulterCount}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5 space-y-0.5">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Compliance Rate</span>
              <span className="text-xl font-bold font-mono text-slate-900">{complianceRate}%</span>
            </div>
          </div>

          {report.defaulterCount > 0 ? (
            <div className="bg-rose-50/40 border border-rose-200/60 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-rose-900 font-bold text-xs">
                <UserX size={15} className="text-rose-700" /> 
                <span>Faculty Members Awaiting Submission ({report.defaulterCount})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {report.defaulters.map((teacher) => (
                  <div
                    key={teacher.id}
                    className="bg-white border border-rose-100 rounded-lg p-2.5 flex items-center justify-between shadow-2xs"
                  >
                    <div className="truncate pr-2">
                      <p className="text-xs font-semibold text-slate-900 truncate">{teacher.fullName}</p>
                      <p className="text-[11px] font-mono text-slate-400 truncate">{teacher.email}</p>
                    </div>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-medium rounded shrink-0">
                      {teacher.department}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200/60 rounded-xl p-4 flex items-center gap-2 text-emerald-800 text-xs font-semibold">
              <CheckCircle2 size={16} className="text-emerald-700" />
              <span>100% Submission Compliance: All faculty members have submitted their plans for {report.weekName}!</span>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
