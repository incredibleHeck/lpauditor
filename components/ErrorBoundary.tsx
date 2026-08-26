"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught Client Error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-lg mx-auto my-12 bg-white border border-slate-200/80 rounded-2xl text-center space-y-4 shadow-xs font-sans">
          <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 w-fit mx-auto rounded-2xl">
            <AlertCircle size={28} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Application Error Encountered</h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {this.state.error?.message || "An unexpected error occurred within this workspace component."}
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-2xs transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-900/20 active:scale-[0.99]"
          >
            <RefreshCw size={13} /> Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
