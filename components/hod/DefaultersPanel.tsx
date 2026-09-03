import React from "react";
import { DefaulterReportData, generateWhatsAppNudgeUrl } from "@/lib/whatsapp";
import { CalendarClock, RefreshCw, Loader2, UserX, CheckCircle2, MessageSquare, AlertTriangle } from "lucide-react";
import { WEEK_OPTIONS } from "@/lib/constants";

interface DefaultersPanelProps {
  report: DefaulterReportData | null;
  loading: boolean;
  onRefresh: () => void;
  onSendAlert: () => void;
  isDispatching: boolean;
  selectedWeek?: string;
  onWeekChange?: (week: string) => void;
}

export default function DefaultersPanel({
  report,
  loading,
  onRefresh,
  onSendAlert,
  isDispatching,
  selectedWeek,
  onWeekChange,
}: DefaultersPanelProps) {
  const complianceRate =
    report && report.totalTeachers > 0
      ? Math.round((report.submittedCount / report.totalTeachers) * 100)
      : 100;

  const currentWeek = selectedWeek || report?.weekName || WEEK_OPTIONS[0];

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-5 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#0B132B] text-white rounded-xl shadow-xs">
            <CalendarClock size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#0B132B]">Submission Deadlines & Defaulter Tracking</h3>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-mono font-bold rounded-md uppercase tracking-wider border border-slate-200">
                {report?.weekName || currentWeek}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Target Deadline: <span className="font-semibold text-slate-900">{report?.deadlineDate || "Friday 17:00"}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onWeekChange && (
            <div className="flex items-center gap-1">
              <select
                aria-label="Select Target Week"
                value={currentWeek}
                onChange={(e) => onWeekChange(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 text-slate-900 text-xs font-semibold rounded-xl shadow-2xs cursor-pointer outline-none focus:ring-2 focus:ring-[#0B132B]/15 focus:border-[#0B132B]"
              >
                {WEEK_OPTIONS.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl transition-all tactile-btn cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh Defaulters
          </button>

          <button
            onClick={onSendAlert}
            disabled={isDispatching}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-all tactile-btn cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-emerald-700/20"
          >
            {isDispatching ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <MessageSquare size={13} />
            )}
            <span>{isDispatching ? "Dispatching…" : "Dispatch WhatsApp Alert"}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-4 space-y-2 animate-pulse">
          <div className="h-4 bg-slate-100 rounded w-1/3"></div>
          <div className="h-8 bg-slate-100 rounded w-full"></div>
        </div>
      ) : report ? (
        <div className="space-y-5">
          
          {/* Institutional Compliance KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3.5 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Assigned Faculty</span>
              <span className="text-2xl font-bold font-mono text-[#0B132B] tabular-nums">{report.totalTeachers}</span>
            </div>
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5 space-y-1">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Submitted</span>
              <span className="text-2xl font-bold font-mono text-emerald-800 tabular-nums">{report.submittedCount}</span>
            </div>
            <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-3.5 space-y-1">
              <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">Pending Defaulters</span>
              <span className="text-2xl font-bold font-mono text-rose-800 tabular-nums">{report.defaulterCount}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3.5 space-y-1">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Compliance Rate</span>
              <span className="text-2xl font-bold font-mono text-[#0B132B] tabular-nums">{complianceRate}%</span>
            </div>
          </div>

          {/* Partially Submitted Faculty Section */}
          {report.partiallySubmitted && report.partiallySubmitted.length > 0 && (
            <div className="bg-amber-50/40 border border-amber-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                <div className="flex items-center gap-2 text-amber-950 font-bold text-xs uppercase tracking-wider">
                  <AlertTriangle size={15} className="text-amber-700" />
                  <span>Partially Submitted Faculty — Quota Deficit ({report.partiallySubmitted.length})</span>
                </div>
                <span className="text-[10px] font-mono text-amber-800 font-semibold bg-amber-100/80 px-2 py-0.5 rounded">
                  Action Required
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {report.partiallySubmitted.map((teacher) => {
                  const nudgeUrl = teacher.phone
                    ? generateWhatsAppNudgeUrl(teacher.phone, teacher.fullName, teacher.missingQuotas, currentWeek)
                    : null;
                  return (
                    <div
                      key={teacher.id}
                      className="bg-white border border-amber-200 rounded-xl p-3.5 flex flex-col justify-between gap-2.5 shadow-2xs"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-bold text-slate-900 truncate">{teacher.fullName}</p>
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-semibold rounded shrink-0">
                            {teacher.department}
                          </span>
                        </div>
                        {teacher.missingQuotas && teacher.missingQuotas.length > 0 && (
                          <div className="mt-1.5 space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                              Missing Allocated Classes:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {teacher.missingQuotas.map((q, idx) => (
                                <span key={idx} className="px-1.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-900 text-[10px] font-mono font-semibold rounded">
                                  {q.className} • {q.subject}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] font-mono text-slate-400 truncate">{teacher.phone || teacher.email}</span>
                        {nudgeUrl ? (
                          <a
                            href={nudgeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold rounded-lg transition-colors tactile-btn"
                          >
                            <MessageSquare size={10} />
                            <span>Nudge</span>
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">No phone</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Full Defaulters Section */}
          {report.defaulterCount > 0 ? (
            <div className="bg-rose-50/30 border border-rose-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-rose-200/60 pb-2">
                <div className="flex items-center gap-2 text-rose-950 font-bold text-xs uppercase tracking-wider">
                  <UserX size={15} className="text-rose-700" />
                  <span>Faculty Members Awaiting Submission ({report.defaulterCount})</span>
                </div>
                <span className="text-[10px] font-mono text-rose-800 font-semibold bg-rose-100/80 px-2 py-0.5 rounded">
                  0 Submissions
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {report.defaulters.map((teacher) => {
                  const nudgeUrl = teacher.phone
                    ? generateWhatsAppNudgeUrl(teacher.phone, teacher.fullName, teacher.missingQuotas, currentWeek)
                    : null;
                  return (
                    <div
                      key={teacher.id}
                      className="bg-white border border-rose-100 rounded-xl p-3.5 flex flex-col justify-between gap-2.5 shadow-2xs"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-bold text-slate-900 truncate">{teacher.fullName}</p>
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-semibold rounded shrink-0">
                            {teacher.department}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 font-mono truncate">{teacher.email}</p>
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] font-mono text-slate-400 truncate">{teacher.phone || "No phone"}</span>
                        {nudgeUrl ? (
                          <a
                            href={nudgeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold rounded-lg transition-colors tactile-btn"
                          >
                            <MessageSquare size={10} />
                            <span>Nudge</span>
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">No phone</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 flex items-center gap-2 text-emerald-900 text-xs font-semibold shadow-2xs">
              <CheckCircle2 size={18} className="text-emerald-700 shrink-0" />
              <span>100% Submission Compliance: All faculty members have submitted their plans for {report.weekName}!</span>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
