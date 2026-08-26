"use client";

import React, { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center font-sans">
      <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-2xl mb-4 text-rose-700 shadow-2xs">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h2 className="text-lg font-bold text-slate-900 mb-1">Unable to load workspace</h2>
      <p className="text-slate-500 mb-6 max-w-md text-xs leading-relaxed">
        {error.message || "An unexpected error occurred while loading this page. Please refresh or try again."}
      </p>
      <button
        onClick={() => reset()}
        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-900/20"
      >
        <RefreshCw size={14} />
        Reload View
      </button>
    </div>
  );
}
