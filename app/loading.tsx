import React from "react";
import { BookOpen, Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3.5 p-6 font-sans">
      <div className="p-3 bg-slate-900 text-white rounded-xl shadow-xs">
        <BookOpen size={24} />
      </div>
      <div className="flex items-center gap-2 text-slate-600">
        <Loader2 className="animate-spin text-slate-900" size={18} />
        <span className="text-xs font-semibold tracking-wide">Loading workspace…</span>
      </div>
    </div>
  );
}
