"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { BookOpen, Mail, Lock, User, Briefcase, ArrowRight, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("TEACHER");
  const [department, setDepartment] = useState("Primary Science");
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
        setErrorMsg("Access Restricted: You must register with an official St. Adelaide International School email address (@stadelaideschool.com).");
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

      setSuccessMsg("Account created successfully! Redirecting to login...");
      
      const idToken = await userCredential.user.getIdToken();
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);

    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Signup failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
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
            <h3 className="text-xl font-bold text-white">Create Account</h3>
            <p className="text-sm text-zinc-400 mt-1">Exclusively for St. Adelaide International School staff (@stadelaideschool.com).</p>
          </div>

          {errorMsg && (
            <div className="p-3.5 bg-red-950/40 border border-red-500/30 rounded-lg flex gap-3 text-red-400 text-sm">
              <AlertCircle className="shrink-0 mt-0.5" size={18} />
              <p>{errorMsg}</p>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-green-950/40 border border-green-500/30 rounded-lg flex gap-3 text-green-400 text-sm">
              <CheckCircle className="shrink-0 mt-0.5" size={18} />
              <p>{successMsg}</p>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSignup}>
            <div className="space-y-1.5">
              <label htmlFor="fullName" className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Full Name
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                  <User size={18} />
                </div>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/80 transition-all text-sm"
                  placeholder="Hector Aryiku"
                />
              </div>
            </div>

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
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/80 transition-all text-sm"
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
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/80 transition-all text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="role" className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Role
                </label>
                <div className="relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                    <Briefcase size={16} />
                  </div>
                  <select
                    id="role"
                    name="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="block w-full pl-9 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/80 transition-all text-sm appearance-none cursor-pointer"
                  >
                    <option value="TEACHER">Teacher</option>
                    <option value="HOD">Head of Dept</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="department" className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Department
                </label>
                <input
                  id="department"
                  name="department"
                  type="text"
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/80 transition-all text-sm"
                  placeholder="Primary Science"
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-lg text-sm font-bold text-black bg-amber-500 hover:bg-amber-400 disabled:bg-amber-600/50 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-500/10 cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin text-black" size={20} />
                ) : (
                  <>
                    Sign Up <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="text-center pt-4 border-t border-zinc-800/80">
            <p className="text-sm text-zinc-500">
              Already have an account?{" "}
              <Link href="/auth/login" className="text-amber-500 hover:text-amber-400 font-semibold transition-all">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
