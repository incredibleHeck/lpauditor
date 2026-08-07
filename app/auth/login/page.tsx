"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { BookOpen, Mail, Lock, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");

    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail.endsWith("@stadelaideschool.com")) {
        setErrorMsg("Access Restricted: Only St. Adelaide International School accounts (@stadelaideschool.com) are permitted.");
        setIsLoading(false);
        return;
      }

      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const userEmail = (userCredential.user.email || "").toLowerCase();

      if (!userEmail.endsWith("@stadelaideschool.com")) {
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
      setErrorMsg(err instanceof Error ? err.message : "Invalid email or password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Dynamic Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-amber-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-amber-600/10 blur-[120px] pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="flex justify-center items-center gap-3 mb-6">
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-500 shadow-lg shadow-amber-500/5">
            <BookOpen size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">HecTech</h2>
            <p className="text-xs text-amber-500/80 font-mono uppercase tracking-wider font-semibold">LPAuditor Portal</p>
          </div>
        </div>
      </div>

      <div className="mt-2 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 sm:px-0">
        <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 py-10 px-6 sm:px-10 rounded-2xl shadow-2xl space-y-6">
          <div>
            <h3 className="text-xl font-bold text-white">Welcome Back</h3>
            <p className="text-sm text-zinc-400 mt-1">Sign in with your St. Adelaide School Google account.</p>
          </div>

          {errorMsg && (
            <div className="p-3.5 bg-red-950/40 border border-red-500/30 rounded-lg flex gap-3 text-red-400 text-sm animate-shake">
              <AlertCircle className="shrink-0 mt-0.5" size={18} />
              <p>{errorMsg}</p>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleLogin}>
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                School Email (@stadelaideschool.com)
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                  <Mail size={18} />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/80 transition-all text-sm"
                  placeholder="name@stadelaideschool.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Password
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                  <Lock size={18} />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/80 transition-all text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-lg text-sm font-bold text-black bg-amber-500 hover:bg-amber-400 disabled:bg-amber-600/50 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-500/10 cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin text-black" size={20} />
                ) : (
                  <>
                    Sign In <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="text-center pt-4 border-t border-zinc-800/80">
            <p className="text-sm text-zinc-500">
              Don&apos;t have an account?{" "}
              <Link href="/auth/signup" className="text-amber-500 hover:text-amber-400 font-semibold transition-all">
                Create one now
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
