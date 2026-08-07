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
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Average Compliance</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-zinc-900">
              {loading ? "..." : `${stats?.averageScore || 0}%`}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500">Across all completed lesson plans</p>
        </div>
        <div className={`p-3 rounded-xl border shrink-0 ${
          (stats?.averageScore || 0) >= 80 ? "bg-emerald-50 border-emerald-100 text-emerald-600" :
          (stats?.averageScore || 0) >= 50 ? "bg-amber-50 border-amber-100 text-amber-600" :
          "bg-red-50 border-red-100 text-red-600"
        }`}>
          <Award size={24} />
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Submission Status</span>
          <div className="text-sm font-semibold text-zinc-700 flex flex-wrap gap-x-3 gap-y-1 mt-1">
            <span className="text-green-600">{stats?.completedCount || 0} Audited</span>
            <span className="text-amber-600">{stats?.pendingCount || 0} Pending</span>
            {stats?.failedCount ? <span className="text-red-500">{stats.failedCount} Failed</span> : null}
          </div>
          <p className="text-[11px] text-zinc-500 mt-0.5">Total: {stats?.totalCount || 0} uploads</p>
        </div>
        <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-zinc-600 shrink-0">
          <Users size={24} />
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Critical Reviews</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-red-600">
              {loading ? "..." : stats?.underperformingCount || 0}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500">Scored under 50% threshold</p>
        </div>
        <div className={`p-3 rounded-xl border shrink-0 ${
          (stats?.underperformingCount || 0) > 0 ? "bg-red-50 border-red-100 text-red-600 animate-pulse" : "bg-zinc-50 border-zinc-100 text-zinc-400"
        }`}>
          <ShieldAlert size={24} />
        </div>
      </div>
    </div>
  );
}
