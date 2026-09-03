"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { BookOpen, Mail, Lock, ArrowRight, Loader2, AlertCircle, ShieldCheck, KeyRound, X, CheckCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { isInstitutionalEmail, SCHOOL_EMAIL_DOMAIN } from "@/lib/constants";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  // Forgot Password modal states
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState("");
  const [resetErrorMsg, setResetErrorMsg] = useState("");

  const router = useRouter();

  const handleDemoLogin = async (demoUser: "teacher-ict" | "hod" | "admin") => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demoUser }),
      });
      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        setErrorMsg("Failed to initialize demo session.");
      }
    } catch (err) {
      setErrorMsg("Error initiating demo session: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");

    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!isInstitutionalEmail(cleanEmail)) {
        setErrorMsg(`Access Restricted: Only official St. Adelaide International School accounts (${SCHOOL_EMAIL_DOMAIN}) are permitted.`);
        setIsLoading(false);
        return;
      }

      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const userEmail = (userCredential.user.email || "").toLowerCase();

      if (!isInstitutionalEmail(userEmail)) {
        await auth.signOut();
        setErrorMsg("Access Restricted: Your email domain is not authorized for St. Adelaide International School.");
        setIsLoading(false);
        return;
      }
      const idToken = await userCredential.user.getIdToken();
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Invalid email address or password.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetLoading(true);
    setResetErrorMsg("");
    setResetSuccessMsg("");

    try {
      const cleanEmail = resetEmail.trim().toLowerCase();
      if (!isInstitutionalEmail(cleanEmail)) {
        setResetErrorMsg(`Access Restricted: Password reset requires an official St. Adelaide International School account (${SCHOOL_EMAIL_DOMAIN}).`);
        setIsResetLoading(false);
        return;
      }

      await sendPasswordResetEmail(auth, cleanEmail);
      setResetSuccessMsg("Password reset email sent! Please check your institutional inbox for instructions.");
    } catch (err: unknown) {
      setResetErrorMsg(err instanceof Error ? err.message : "Failed to dispatch password reset email. Please verify the address.");
    } finally {
      setIsResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Institutional Branding */}
        <div className="flex flex-col items-center text-center mb-8 space-y-2">
          <div className="w-14 h-14 bg-[#0B132B] text-white rounded-2xl shadow-xs border border-slate-800 flex items-center justify-center">
            <BookOpen size={28} className="text-slate-100" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0B132B]">
              St. Adelaide International School
            </h1>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
              Cambridge International Centre GH-924 • LPAuditor Portal
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-slate-200/90 p-8 sm:p-10 rounded-2xl shadow-xs space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-[#0B132B]">Faculty Sign In</h2>
            <p className="text-xs text-slate-500">
              Enter your institutional credentials to access your lesson plan compliance dashboard.
            </p>
          </div>

          {/* School Domain Policy Notice */}
          <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl flex items-start gap-2.5 text-slate-600 text-xs">
            <ShieldCheck className="shrink-0 text-slate-700 mt-0.5" size={16} />
            <p className="leading-relaxed">
              Authorized access is restricted to verified <strong className="font-semibold text-slate-900">@stadelaideschool.com</strong> staff accounts.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs leading-relaxed animate-shake">
              <AlertCircle className="shrink-0 text-rose-600 mt-0.5" size={16} />
              <p>{errorMsg}</p>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleLogin}>
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-semibold text-slate-700">
                School Email
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail size={16} />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  spellCheck={false}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all text-xs"
                  placeholder="name@stadelaideschool.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setResetSuccessMsg("");
                    setResetErrorMsg("");
                    setShowResetModal(true);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-900 font-medium underline-offset-2 hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={16} />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all text-xs"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-xl text-xs font-semibold text-white bg-[#0B132B] hover:bg-[#1C2541] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-[#0B132B]/20 tactile-btn"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Portal</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Interactive Demo Sandbox / Quick Testing Accounts */}
          <div className="pt-5 border-t border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#0B132B] uppercase tracking-wider">
                <Sparkles size={14} className="text-amber-600" />
                <span>Quick Testing Sandbox</span>
              </div>
              <span className="text-[10px] font-mono font-bold bg-[#0B132B] text-white px-2 py-0.5 rounded uppercase">
                Instant Sign-In
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Select an institutional role to test the system with pre-configured Cambridge curriculum quotas:
            </p>

            <div className="grid grid-cols-1 gap-2.5">
              {/* 1. ICT Teacher Demo Account */}
              <button
                type="button"
                onClick={() => handleDemoLogin("teacher-ict")}
                disabled={isLoading}
                className="w-full flex items-center justify-between p-3 bg-[#F8FAFC] hover:bg-white hover:border-[#0B132B] border border-slate-200/90 rounded-xl transition-all tactile-btn text-left group shadow-2xs cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                    ICT
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#0B132B] group-hover:text-indigo-900">
                        Mr. Derrick Thompson
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 font-mono">
                        (TEACHER)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Department: ICT • Classes: Year 5, 6, 7 & 8
                    </p>
                  </div>
                </div>
                <ArrowRight size={14} className="text-slate-400 group-hover:text-[#0B132B] group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* 2. HOD Demo Account */}
              <button
                type="button"
                onClick={() => handleDemoLogin("hod")}
                disabled={isLoading}
                className="w-full flex items-center justify-between p-3 bg-[#F8FAFC] hover:bg-white hover:border-[#0B132B] border border-slate-200/90 rounded-xl transition-all tactile-btn text-left group shadow-2xs cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                    HOD
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#0B132B] group-hover:text-emerald-900">
                        Mrs. Abigail Sackey
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 font-mono">
                        (HOD)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Upper Primary Head • Science & ICT Oversight
                    </p>
                  </div>
                </div>
                <ArrowRight size={14} className="text-slate-400 group-hover:text-[#0B132B] group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* 3. Admin Demo Account */}
              <button
                type="button"
                onClick={() => handleDemoLogin("admin")}
                disabled={isLoading}
                className="w-full flex items-center justify-between p-3 bg-[#F8FAFC] hover:bg-white hover:border-[#0B132B] border border-slate-200/90 rounded-xl transition-all tactile-btn text-left group shadow-2xs cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    ADM
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#0B132B] group-hover:text-slate-900">
                        Mr. Ayiku
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 font-mono">
                        (ADMIN)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Lead Academic Administrator • All Divisions
                    </p>
                  </div>
                </div>
                <ArrowRight size={14} className="text-slate-400 group-hover:text-[#0B132B] group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          <div className="text-center pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              New faculty member?{" "}
              <Link href="/auth/signup" className="text-slate-900 font-semibold hover:underline underline-offset-4">
                Register account
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-slate-400 mt-8">
          © 2026 St. Adelaide International School • Powered by HecTech LPAuditor
        </p>
      </div>

      {/* Forgot Password Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in font-sans">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
                <KeyRound size={18} className="text-slate-800" />
                Reset Faculty Password
              </div>
              <button
                onClick={() => setShowResetModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Enter your official St. Adelaide International School email address to receive a secure password reset link.
            </p>

            {resetSuccessMsg && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-800 text-xs leading-relaxed">
                <CheckCircle className="shrink-0 text-emerald-600 mt-0.5" size={16} />
                <p>{resetSuccessMsg}</p>
              </div>
            )}

            {resetErrorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs leading-relaxed">
                <AlertCircle className="shrink-0 text-rose-600 mt-0.5" size={16} />
                <p>{resetErrorMsg}</p>
              </div>
            )}

            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">School Email</label>
                <div className="relative rounded-lg shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail size={16} />
                  </div>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="name@stadelaideschool.com"
                    className="block w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-xs outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isResetLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isResetLoading ? <Loader2 className="animate-spin" size={14} /> : <Mail size={14} />}
                  <span>Send Reset Link</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
