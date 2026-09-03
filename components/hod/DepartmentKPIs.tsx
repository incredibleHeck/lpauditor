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
  const isPassing = avg >= 70;
  const isExemplary = avg >= 80;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans">
      
      {/* Average Compliance Score */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Department Compliance Average
          </span>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold font-mono tabular-nums ${
              isPassing ? "text-emerald-700" : "text-rose-700"
            }`}>
              {loading ? "…" : `${avg}%`}
            </span>
            <span className="text-[11px] font-semibold text-slate-400">
              {isPassing ? "(Compliant ≥ 70%)" : "(Deficit < 70%)"}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">Benchmark: Cambridge International Framework</p>
        </div>
        <div className={`p-3 rounded-xl border shrink-0 ${
          isExemplary ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
          isPassing ? "bg-emerald-50/70 border-emerald-200/80 text-emerald-800" :
          "bg-rose-50 border-rose-200 text-rose-800"
        }`}>
          <Award size={22} />
        </div>
      </div>

      {/* Submission Pipeline */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Curriculum Submission Pipeline
          </span>
          <div className="text-xs font-semibold text-slate-800 flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1">
            <span className="text-emerald-700 font-mono font-bold">{stats?.completedCount || 0} Audited</span>
            <span className="text-slate-300">•</span>
            <span className="text-amber-700 font-mono font-bold">{stats?.pendingCount || 0} Pending</span>
            {Boolean(stats?.failedCount) && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-rose-700 font-mono font-bold">{stats?.failedCount} Failed</span>
              </>
            )}
          </div>
          <p className="text-[11px] text-slate-500 font-mono mt-0.5">Total Uploads: {stats?.totalCount || 0}</p>
        </div>
        <div className="p-3 bg-slate-100 border border-slate-200 text-slate-800 rounded-xl shrink-0">
          <Users size={22} />
        </div>
      </div>

      {/* Critical Interventions */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Pedagogical Interventions
          </span>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold font-mono tabular-nums ${
              (stats?.underperformingCount || 0) > 0 ? "text-rose-700" : "text-[#0B132B]"
            }`}>
              {loading ? "…" : stats?.underperformingCount || 0}
            </span>
            <span className="text-[11px] font-medium text-slate-400">Plans Flagged</span>
          </div>
          <p className="text-[11px] text-slate-500">Scored below 70% passing threshold</p>
        </div>
        <div className={`p-3 rounded-xl border shrink-0 ${
          (stats?.underperformingCount || 0) > 0 
            ? "bg-rose-50 border-rose-200 text-rose-800" 
            : "bg-slate-100 border-slate-200 text-slate-400"
        }`}>
          <ShieldAlert size={22} />
        </div>
      </div>

    </div>
  );
}
