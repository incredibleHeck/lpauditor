import React from "react";
import { DefaulterReportData } from "@/lib/telegram";
import { CalendarClock, RefreshCw, Send, Loader2, UserX, CheckCircle } from "lucide-react";

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
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-xl text-blue-600">
            <CalendarClock size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-900">Weekly Submission Deadline & Defaulters</h3>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-extrabold rounded-full uppercase">
                {report?.weekName || "Current Week"}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Target Deadline: <span className="font-semibold text-zinc-700">{report?.deadlineDate || "Friday 17:00"}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs rounded-lg transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh Defaulters
          </button>

          <button
            onClick={onSendAlert}
            disabled={isDispatching}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-lg shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            {isDispatching ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            {isDispatching ? "Dispatching..." : "Send Telegram Alert"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-4 space-y-2 animate-pulse">
          <div className="h-4 bg-zinc-100 rounded w-1/3"></div>
          <div className="h-8 bg-zinc-100 rounded w-full"></div>
        </div>
      ) : report ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-3">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total Teachers</span>
              <span className="text-lg font-black text-zinc-800">{report.totalTeachers}</span>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Submitted</span>
              <span className="text-lg font-black text-emerald-700">{report.submittedCount}</span>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
              <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block">Defaulters</span>
              <span className="text-lg font-black text-red-700">{report.defaulterCount}</span>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Compliance Rate</span>
              <span className="text-lg font-black text-blue-700">
                {report.totalTeachers > 0
                  ? `${Math.round((report.submittedCount / report.totalTeachers) * 100)}%`
                  : "100%"}
              </span>
            </div>
          </div>

          {report.defaulterCount > 0 ? (
            <div className="bg-red-50/50 border border-red-200/60 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-red-800 font-bold text-xs uppercase tracking-wide">
                <UserX size={15} /> Teachers Pending Lesson Plan Submission ({report.defaulterCount})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                {report.defaulters.map((teacher) => (
                  <div
                    key={teacher.id}
                    className="bg-white border border-red-100 rounded-lg p-2.5 flex items-center justify-between shadow-2xs"
                  >
                    <div className="truncate pr-2">
                      <p className="text-xs font-bold text-zinc-900 truncate">{teacher.fullName}</p>
                      <p className="text-[11px] text-zinc-500 truncate">{teacher.email}</p>
                    </div>
                    <span className="px-2 py-0.5 bg-zinc-100 text-zinc-700 text-[10px] font-semibold rounded shrink-0">
                      {teacher.department}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-2 text-emerald-800 text-xs font-semibold">
              <CheckCircle size={16} /> All teachers have submitted their lesson plans for {report.weekName}!
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
