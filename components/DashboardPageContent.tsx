"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import LessonPlanDropzone from "./LessonPlanDropzone";
import SubmissionsDashboard from "./SubmissionsDashboard";
import HODDashboard from "./HODDashboard";
import { BookOpen, LogOut, Shield, UserCheck } from "lucide-react";
import type { Submission, UserProfile } from "@/lib/types";

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
  const router = useRouter();

  const handleUploadSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/auth/login");
    router.refresh();
  };

  const teacherName = profile?.full_name || "St. Adelaide Staff";
  const department = profile?.department || "All Departments";
  const role = profile?.role || "TEACHER";
  const isHOD = role === "HOD" || role === "ADMIN";
  const isAdmin = role === "ADMIN";

  const [activeTab, setActiveTab] = useState<"teacher" | "hod">(
    isAdmin && profile?.department === "Administration" ? "hod" : "teacher"
  );

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 font-sans p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Enterprise Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-200 pb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-600">
              <BookOpen size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">
                HecTech LPAuditor
              </h1>
              <p className="text-sm text-zinc-500">
                {teacherName} • {isAdmin ? "School Administrator" : `${department} Department`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isHOD && (
              <div className="flex items-center p-1 bg-zinc-200/70 border border-zinc-300/80 rounded-xl text-xs font-bold">
                <button
                  onClick={() => setActiveTab("teacher")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeTab === "teacher"
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  <UserCheck size={14} /> My Submissions
                </button>
                <button
                  onClick={() => setActiveTab("hod")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeTab === "hod"
                      ? "bg-amber-500 text-black font-extrabold shadow-sm"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  <Shield size={14} /> {isAdmin ? "Admin Compliance Portal" : "HOD Department Portal"}
                </button>
              </div>
            )}

            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0"
            >
              <LogOut size={14} /> Log Out
            </button>
          </div>
        </div>

        {/* Tab View Switcher */}
        {activeTab === "hod" && isHOD ? (
          <HODDashboard
            initialSubmissions={[]}
            department={department}
            refreshTrigger={refreshTrigger}
          />
        ) : (
          <>
            {/* Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left Column: Submission Form Card */}
              <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-xl p-6 md:p-8 shadow-sm space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900">Submit Weekly Lesson Plan</h2>
                  <p className="text-sm text-zinc-500 mt-1">
                    Upload your document to initialize the automated Cambridge pedagogical audit.
                  </p>
                </div>
                
                {/* Dropzone */}
                <LessonPlanDropzone onUploadSuccess={handleUploadSuccess} />
              </div>

              {/* Right Column: Mini Info Card */}
              <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm h-fit space-y-5">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                  Audit Guidelines
                </h3>
                <ul className="space-y-4 text-sm text-zinc-600">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500 mt-2"></span>
                    <p>Ensure layout tracking forms are left intact within your Word document.</p>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500 mt-2"></span>
                    <p>Specify dedicated Test or Assessment days directly within your main activity block.</p>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500 mt-2"></span>
                    <p>Continuous assessment data must follow chronological subject sequencing.</p>
                  </li>
                </ul>
              </div>

            </div>

            {/* Submissions Dashboard List */}
            <div className="pt-4">
              <SubmissionsDashboard
                initialSubmissions={initialSubmissions}
                teacherId={teacherId}
                refreshTrigger={refreshTrigger}
              />
            </div>
          </>
        )}

        <footer className="text-center pt-8 border-t border-zinc-100">
          <p className="text-xs text-zinc-400">© 2026 HecTech Ltd. Powered by Gemini & Firebase.</p>
        </footer>
      </div>
    </main>
  );
}
