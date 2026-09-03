"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import LessonPlanDropzone from "./LessonPlanDropzone";
import SubmissionsDashboard from "./SubmissionsDashboard";
import HODDashboard from "./HODDashboard";
import { BookOpen, LogOut, Shield, UserCheck, CheckCircle2, FileCheck } from "lucide-react";
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
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 sm:p-6 lg:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Institutional Top Navigation Bar */}
        <header className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-2xs shrink-0 flex items-center justify-center">
              <BookOpen size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  St. Adelaide International School
                </h1>
                <span className="hidden sm:inline-flex px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-semibold rounded-md uppercase tracking-wider">
                  Cambridge v2.1
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                HecTech LPAuditor • {teacherName} <span className="text-slate-300">•</span> {isAdmin ? "Administrator" : `${department} Department`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
            {isHOD && (
              <div className="flex items-center p-1 bg-slate-100 border border-slate-200/70 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setActiveTab("teacher")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeTab === "teacher"
                      ? "bg-white text-slate-900 shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <UserCheck size={14} /> My Submissions
                </button>
                <button
                  onClick={() => setActiveTab("hod")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeTab === "hod"
                      ? "bg-slate-900 text-white shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Shield size={14} /> {isAdmin ? "Admin Portal" : "HOD Department Portal"}
                </button>
              </div>
            )}

            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-slate-900/20 active:scale-[0.99]"
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
            {/* Teacher Dashboard Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: Upload Submission Form */}
              <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
                <div>
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">
                    {revisionTarget ? "Submit Lesson Plan Revision" : "Submit Weekly Lesson Plan"}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {revisionTarget 
                      ? `Uploading revision for ${revisionTarget.week_name} ${revisionTarget.subject} (${revisionTarget.grade_level}).`
                      : "Upload your lesson plan document to initialize automated Cambridge pedagogical compliance auditing."
                    }
                  </p>
                </div>
                
                {/* Dropzone Component */}
                <LessonPlanDropzone 
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
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs h-fit space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
                  <FileCheck size={16} className="text-slate-700" />
                  Cambridge Rubric Checklist
                </div>
                <ul className="space-y-3.5 text-xs text-slate-600">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 size={15} className="text-slate-900 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <strong className="text-slate-800">Learning Objectives:</strong> State clear SMART objectives with measurable Cambridge command verbs.
                    </p>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 size={15} className="text-slate-900 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <strong className="text-slate-800">Time & Pacing:</strong> Allocate duration for Starter, Main inquiry, Assessment, and Plenary.
                    </p>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 size={15} className="text-slate-900 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <strong className="text-slate-800">Differentiation & EAL:</strong> Document explicit scaffolding for varying learner abilities.
                    </p>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 size={15} className="text-slate-900 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <strong className="text-slate-800">Document Layout:</strong> Preserve standard Cambridge template headers and assessment tables.
                    </p>
                  </li>
                </ul>
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

        <footer className="text-center pt-8 border-t border-slate-200 text-xs text-slate-400">
          <p>© 2026 St. Adelaide International School • Powered by Gemini & Firebase</p>
        </footer>
      </div>
    </main>
  );
}
