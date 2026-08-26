"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { BookOpen, Mail, Lock, User, Briefcase, Building2, ArrowRight, Loader2, AlertCircle, CheckCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { DEPARTMENTS } from "@/lib/constants";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("TEACHER");
  const [department, setDepartment] = useState<string>(DEPARTMENTS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail.endsWith("@stadelaideschool.com")) {
        setErrorMsg("Access Restricted: Registration requires an official St. Adelaide International School email address (@stadelaideschool.com).");
        setIsLoading(false);
        return;
      }

      const adminEmails = [
        "theodorahammond@stadelaideschool.com",
        "hectoraryiku@stadelaideschool.com",
        "abigailsackey@stadelaideschool.com"
      ];
      const assignedRole = adminEmails.includes(cleanEmail) ? "ADMIN" : role;
      const assignedDept = cleanEmail === "theodorahammond@stadelaideschool.com" ? "Administration" : department;

      // 1. Create User in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;

      // 2. Save User Profile in Cloud Firestore
      await setDoc(doc(db, "profiles", user.uid), {
        id: user.uid,
        full_name: fullName,
        email: cleanEmail,
        role: assignedRole,
        department: assignedDept,
        created_at: new Date().toISOString()
      });

      setSuccessMsg("Account registered successfully! Establishing session…");
      
      const idToken = await userCredential.user.getIdToken();
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      setTimeout(() => {
        router.push("/");
      }, 1500);

    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Signup failed. Please check your details and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Institutional Branding */}
        <div className="flex flex-col items-center text-center mb-8 space-y-2">
          <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-sm flex items-center justify-center">
            <BookOpen size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              St. Adelaide International School
            </h1>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
              Faculty Account Registration • HecTech LPAuditor
            </p>
          </div>
        </div>

        {/* Signup Card */}
        <div className="bg-white border border-slate-200/80 p-8 sm:p-10 rounded-2xl shadow-xs space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900">Create Faculty Profile</h2>
            <p className="text-xs text-slate-500">
              Register with your school email to submit and track Cambridge lesson plans.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl flex items-start gap-2.5 text-slate-600 text-xs">
            <ShieldCheck className="shrink-0 text-slate-700 mt-0.5" size={16} />
            <p className="leading-relaxed">
              Restricted to verified <strong className="font-semibold text-slate-900">@stadelaideschool.com</strong> educators and administrators.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs leading-relaxed">
              <AlertCircle className="shrink-0 text-rose-600 mt-0.5" size={16} />
              <p>{errorMsg}</p>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-800 text-xs leading-relaxed">
              <CheckCircle className="shrink-0 text-emerald-600 mt-0.5" size={16} />
              <p>{successMsg}</p>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSignup}>
            <div className="space-y-1.5">
              <label htmlFor="fullName" className="block text-xs font-semibold text-slate-700">
                Full Name
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User size={16} />
                </div>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all text-xs"
                  placeholder="e.g. Hector Aryiku"
                />
              </div>
            </div>

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
                  className="block w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all text-xs"
                  placeholder="name@stadelaideschool.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-semibold text-slate-700">
                Password
              </label>
              <div className="relative rounded-lg shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={16} />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all text-xs"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="role" className="block text-xs font-semibold text-slate-700">
                  Institutional Role
                </label>
                <div className="relative rounded-lg shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Briefcase size={15} />
                  </div>
                  <select
                    id="role"
                    name="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="block w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all text-xs cursor-pointer"
                  >
                    <option value="TEACHER">Teacher</option>
                    <option value="HOD">Head of Department (HOD)</option>
                    <option value="ADMIN">Administrator</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="department" className="block text-xs font-semibold text-slate-700">
                  Department
                </label>
                <div className="relative rounded-lg shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Building2 size={15} />
                  </div>
                  <select
                    id="department"
                    name="department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="block w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all text-xs cursor-pointer"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                    <option value="Administration">Administration</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-900/20 active:scale-[0.99]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    <span>Creating account…</span>
                  </>
                ) : (
                  <>
                    <span>Create Faculty Account</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="text-center pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              Already have an account?{" "}
              <Link href="/auth/login" className="text-slate-900 font-semibold hover:underline underline-offset-4">
                Sign In
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-slate-400 mt-8">
          © 2026 St. Adelaide International School • Powered by HecTech LPAuditor
        </p>
      </div>
    </div>
  );
}
