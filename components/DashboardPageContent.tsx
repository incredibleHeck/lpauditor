"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import LessonPlanDropzone from "./LessonPlanDropzone";
import SubmissionsDashboard from "./SubmissionsDashboard";
import HODDashboard from "./HODDashboard";
import { BookOpen, LogOut, Shield, UserCheck, CheckCircle2, FileCheck, Sparkles } from "lucide-react";
import type { Submission, UserProfile, SubmissionContext } from "@/lib/types";

interface DashboardPageContentProps {
  initialSubmissions: Submission[];
  teacherId: string;
  profile: UserProfile | null;
}

export default function DashboardPageContent({
  initialSubmissions,
  teacherId,
  profile,
}: DashboardPageContentProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [revisionTarget, setRevisionTarget] = useState<SubmissionContext | null>(null);
  const router = useRouter();

  const handleUploadSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
    setRevisionTarget(null);
  };

  const handleSignOut = async () => {
    await signOut(auth);
    await fetch("/api/auth/session", { method: "DELETE" });
    router.push("/auth/login");
    router.refresh();
  };

  const teacherName = profile?.full_name || "Faculty Member";
  const department = profile?.department || "General Faculty";
  const role = profile?.role || "TEACHER";
  const isHOD = role === "HOD" || role === "ADMIN";
  const isAdmin = role === "ADMIN";

  const [activeTab, setActiveTab] = useState<"teacher" | "hod">(
    isAdmin && profile?.department === "Administration" ? "hod" : "teacher"
  );

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#0B132B] font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Institutional Command Header */}
        <header className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#0B132B] text-white flex items-center justify-center shadow-xs shrink-0 border border-slate-800">
              <BookOpen size={24} className="text-slate-100" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold text-[#0B132B] tracking-tight">
                  St. Adelaide International School
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 border border-slate-200/80 text-[#1C2541] text-[10px] font-mono font-semibold rounded-md tracking-wide">
                  <span>GH-924</span>
                  <span className="text-slate-300">•</span>
                  <span>Cambridge International</span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 font-medium mt-1">
                <span className="text-slate-900 font-semibold">{teacherName}</span>
                <span className="text-slate-300">•</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200/70">
                  {isAdmin ? "Administrator" : isHOD ? `HOD • ${department}` : `${department} Faculty`}
                </span>
                <span className="text-slate-300 hidden sm:inline">•</span>
                <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/70">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                  Pedagogical Audit Engine v2.1 Active
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
            {isHOD && (
              <div className="flex items-center p-1 bg-slate-100 border border-slate-200/80 rounded-xl text-xs font-semibold shadow-2xs" role="tablist" aria-label="Workspace View Switcher">
                <button
                  role="tab"
                  aria-selected={activeTab === "teacher"}
                  onClick={() => setActiveTab("teacher")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all tactile-btn cursor-pointer ${
                    activeTab === "teacher"
                      ? "bg-white text-[#0B132B] shadow-2xs font-bold border border-slate-200/60"
                      : "text-slate-600 hover:text-[#0B132B]"
                  }`}
                >
                  <UserCheck size={14} /> Teacher Workspace
                </button>
                <button
                  role="tab"
                  aria-selected={activeTab === "hod"}
                  onClick={() => setActiveTab("hod")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all tactile-btn cursor-pointer ${
                    activeTab === "hod"
                      ? "bg-[#0B132B] text-white shadow-2xs font-bold"
                      : "text-slate-600 hover:text-[#0B132B]"
                  }`}
                >
                  <Shield size={14} /> Department Governance
                </button>
              </div>
            )}
            {/* Sandbox Demo Role Switcher */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50/80 border border-amber-200/90 rounded-xl text-xs shadow-2xs">
              <Sparkles size={13} className="text-amber-700 shrink-0" />
              <span className="text-[11px] font-bold text-amber-900 hidden sm:inline">Demo Role:</span>
              <select
                aria-label="Switch Demo Testing Role"
                value={
                  profile?.role === "ADMIN" ? "admin" :
                  profile?.role === "HOD" ? "hod" : "teacher-ict"
                }
                onChange={async (e) => {
                  const demoUser = e.target.value;
                  await fetch("/api/auth/session", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ demoUser }),
                  });
                  window.location.reload();
                }}
                className="bg-white border border-amber-200 text-amber-950 text-xs font-semibold rounded-lg px-2 py-1 outline-none cursor-pointer focus:ring-1 focus:ring-amber-500"
              >
                <option value="teacher-ict">👨‍💻 ICT Teacher (Mr. Derrick)</option>
                <option value="hod">📋 HOD (Mrs. Abigail)</option>
                <option value="admin">🏛️ Admin (Mr. Ayiku)</option>
              </select>
            </div>

            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-all tactile-btn cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-slate-900/20"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </header>

        {/* Tab View Switcher */}
        {activeTab === "hod" && isHOD ? (
          <HODDashboard
            initialSubmissions={[]}
            department={department}
            isAdmin={isAdmin}
            refreshTrigger={refreshTrigger}
          />
        ) : (
          <>
            {/* Top Row: Dropzone & Standards Reference Card */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column (2 Cols): Dynamic Lesson Plan Dropzone */}
              <div className="lg:col-span-2 space-y-3">
                <div>
                  <h2 className="text-base font-bold text-[#0B132B] tracking-tight">
                    {revisionTarget ? "Curriculum Revision Upload" : "Upload Weekly Lesson Plan"}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {revisionTarget 
                      ? `Uploading revision for ${revisionTarget.week_name} ${revisionTarget.subject} (${revisionTarget.grade_level}). Previous evaluation criteria will be updated.`
                      : "Upload your weekly curriculum documentation (.pdf or .docx) to initialize multimodal Cambridge compliance auditing."
                    }
                  </p>
                </div>
                
                {/* Dropzone Component */}
                <LessonPlanDropzone 
                  teacherId={teacherId}
                  onUploadSuccess={handleUploadSuccess}
                  initialSubject={revisionTarget?.subject}
                  initialGradeLevel={revisionTarget?.grade_level}
                  initialWeekName={revisionTarget?.week_name}
                  parentSubmissionId={revisionTarget?.id}
                  parentVersion={revisionTarget?.version || 1}
                  onCancelRevision={() => setRevisionTarget(null)}
                  assignedSubjects={profile?.assigned_subjects}
                  assignedClasses={profile?.assigned_classes}
                  expectedQuotas={profile?.expected_quotas}
                  isAdmin={isAdmin}
                />
              </div>

              {/* Right Column: Cambridge Standards Info Card */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs h-fit space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#0B132B] uppercase tracking-wider">
                    <FileCheck size={16} className="text-[#1C2541]" />
                    Cambridge Evaluation Rubric
                  </div>
                  <span className="text-[9px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                    PASS ≥ 70%
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Automated checks evaluate lesson submissions against formal Cambridge Primary, Lower Secondary, and IGCSE curriculum benchmarks:
                </p>

                <ul className="space-y-3.5 text-xs text-slate-600">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 size={15} className="text-emerald-700 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <strong className="text-slate-900 font-semibold">SMART Objectives:</strong> Verifiable Cambridge command verbs (e.g. <em>Investigate, Evaluate, Calculate</em>).
                    </p>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 size={15} className="text-emerald-700 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <strong className="text-slate-900 font-semibold">Pacing & Pacing Feasibility:</strong> Defined time boundaries for Starter inquiry, Main activity, and Plenary recap.
                    </p>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 size={15} className="text-emerald-700 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <strong className="text-slate-900 font-semibold">Differentiation & EAL:</strong> Explicit learning tiers (Foundation, Core, Extension) and language support.
                    </p>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 size={15} className="text-emerald-700 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <strong className="text-slate-900 font-semibold">Cognitive Demand:</strong> Appropriate Bloom&apos;s Taxonomy distribution with higher-order evaluation tasks.
                    </p>
                  </li>
                </ul>

                <div className="pt-2 border-t border-slate-100">
                  <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-[11px] text-slate-600 space-y-1">
                    <span className="font-bold text-slate-800 block uppercase text-[10px] tracking-wider">HOD Sign-Off Policy</span>
                    <p className="leading-relaxed">
                      Submissions scoring below 70% automatically require teacher revision before HOD sign-off can be granted.
                    </p>
                  </div>
                </div>
              </div>

            </div>

            {/* Teacher Submissions Dashboard */}
            <div className="pt-2">
              <SubmissionsDashboard
                initialSubmissions={initialSubmissions}
                teacherId={teacherId}
                teacherName={teacherName}
                refreshTrigger={refreshTrigger}
                onRequestRevision={(sub) => {
                  setRevisionTarget(sub);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            </div>
          </>
        )}

        <footer className="text-center pt-8 border-t border-slate-200/80 text-xs text-slate-500 font-medium">
          <p>© 2026 St. Adelaide International School • Center ID GH-924 • Cambridge Pedagogical Compliance Engine</p>
        </footer>
      </div>
    </main>
  );
}
