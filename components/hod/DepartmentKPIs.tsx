import React from "react";
import { Award, Users, ShieldAlert } from "lucide-react";

interface AnalyticsStats {
  totalCount: number;
  completedCount: number;
  pendingCount: number;
  failedCount: number;
  averageScore: number;
  underperformingCount: number;
  commonFlags: string[];
}

interface DepartmentKPIsProps {
  stats: AnalyticsStats | undefined;
  loading: boolean;
}

export default function DepartmentKPIs({ stats, loading }: DepartmentKPIsProps) {
  const avg = stats?.averageScore || 0;
  const isHigh = avg >= 80;
  const isMid = avg >= 70;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans">
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Average Compliance</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {loading ? "…" : `${avg}%`}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">Across all completed department plans</p>
        </div>
        <div className={`p-3 rounded-xl border shrink-0 ${
          isHigh ? "bg-emerald-50 border-emerald-100 text-emerald-700" :
          isMid ? "bg-indigo-50 border-indigo-100 text-indigo-700" :
          "bg-rose-50 border-rose-100 text-rose-700"
        }`}>
          <Award size={22} />
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Submission Pipeline</span>
          <div className="text-xs font-semibold text-slate-700 flex flex-wrap gap-x-2.5 gap-y-1 mt-1">
            <span className="text-emerald-700 font-mono">{stats?.completedCount || 0} Audited</span>
            <span className="text-slate-300">•</span>
            <span className="text-amber-700 font-mono">{stats?.pendingCount || 0} Pending</span>
            {Boolean(stats?.failedCount) && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-rose-700 font-mono">{stats?.failedCount} Failed</span>
              </>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Total: {stats?.totalCount || 0} weekly uploads</p>
        </div>
        <div className="p-3 bg-slate-100 border border-slate-200/70 rounded-xl text-slate-700 shrink-0">
          <Users size={22} />
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Critical Interventions</span>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl font-bold font-mono tabular-nums ${(stats?.underperformingCount || 0) > 0 ? "text-rose-700" : "text-slate-900"}`}>
              {loading ? "…" : stats?.underperformingCount || 0}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">Scored below 70% passing threshold</p>
        </div>
        <div className={`p-3 rounded-xl border shrink-0 ${
          (stats?.underperformingCount || 0) > 0 ? "bg-rose-50 border-rose-100 text-rose-700" : "bg-slate-100 border-slate-200/70 text-slate-400"
        }`}>
          <ShieldAlert size={22} />
        </div>
      </div>
    </div>
  );
}
