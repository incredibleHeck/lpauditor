"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
      <div className="bg-red-50 p-4 rounded-full mb-4">
        <AlertCircle className="w-10 h-10 text-red-500" />
      </div>
      <h2 className="text-xl font-bold text-zinc-900 mb-2">Something went wrong</h2>
      <p className="text-zinc-500 mb-6 max-w-md text-sm">
        {error.message || "An unexpected error occurred while loading this page."}
      </p>
      <button
        onClick={() => reset()}
        className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg transition-colors shadow-sm"
      >
        <RefreshCw size={18} />
        Try Again
      </button>
    </div>
  );
}
