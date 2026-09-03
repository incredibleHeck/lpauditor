"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import DashboardPageContent from "@/components/DashboardPageContent";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Loader2, BookOpen } from "lucide-react";
import { isInstitutionalEmail } from "@/lib/constants";
import type { UserProfile } from "@/lib/types";

export const DEMO_PROFILES: Record<string, UserProfile & { uid: string; email: string }> = {
  "teacher-ict": {
    uid: "demo-teacher-ict",
    email: "derrick.thompson@stadelaideschool.com",
    full_name: "Mr. Derrick Thompson",
    role: "TEACHER",
    department: "ICT",
    assigned_subjects: ["ICT"],
    assigned_classes: ["Year 5 (Streams A & B)", "Year 6 (Streams A & B)", "Year 7 (Streams A & B)", "Year 8"],
    expected_quotas: [
      { subject: "ICT", className: "Year 5 (Streams A & B)" },
      { subject: "ICT", className: "Year 6 (Streams A & B)" },
      { subject: "ICT", className: "Year 7 (Streams A & B)" },
      { subject: "ICT", className: "Year 8" },
    ],
  },
  "hod": {
    uid: "demo-hod-science",
    email: "abigailsackey@stadelaideschool.com",
    full_name: "Mrs. Abigail Sackey",
    role: "HOD",
    department: "Upper Primary",
    assigned_subjects: ["Science"],
    assigned_classes: ["Year 4 (Streams A & B)", "Year 5 (Streams A & B)", "Year 6 (Streams A & B)"],
  },
  "admin": {
    uid: "demo-admin",
    email: "hectoraryiku@stadelaideschool.com",
    full_name: "Mr. Ayiku",
    role: "ADMIN",
    department: "Administration",
  },
};

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const checkSessionAndAuth = async () => {
      // 1. Check for active demo session first
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const session = await res.json();
          if (session.demoUser && isMounted) {
            const demoKey = session.demoUser === "hod-science" ? "hod" : session.demoUser;
            const demoProfile = DEMO_PROFILES[demoKey] || DEMO_PROFILES["teacher-ict"];
            setCurrentUser({
              uid: demoProfile.uid,
              email: demoProfile.email,
              displayName: demoProfile.full_name,
            } as User);
            setProfile(demoProfile);
            setLoading(false);
            return;
          }
        }
      } catch {
        // Continue to Firebase Auth
      }

      // 2. Standard Firebase Auth Listener
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!isMounted) return;

        if (!user) {
          router.push("/auth/login");
          return;
        }

        const userEmail = (user.email || "").toLowerCase();
        if (!isInstitutionalEmail(userEmail)) {
          await auth.signOut();
          router.push("/auth/login");
          return;
        }

        setCurrentUser(user);

        try {
          const docRef = doc(db, "profiles", user.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists() && isMounted) {
            setProfile(docSnap.data() as UserProfile);
          } else if (isMounted) {
            setProfile({
              full_name: user.displayName || "Faculty Member",
              role: "TEACHER",
              department: "Primary Science",
            });
          }
        } catch (err) {
          console.error("Failed to load user profile:", err);
        } finally {
          if (isMounted) setLoading(false);
        }
      });

      return unsubscribe;
    };

    let authUnsubscribe: (() => void) | undefined;
    checkSessionAndAuth().then((unsub) => {
      authUnsubscribe = unsub;
    });

    return () => {
      isMounted = false;
      if (authUnsubscribe) authUnsubscribe();
    };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center gap-3.5 font-sans text-slate-900 p-6">
        <div className="p-3.5 bg-slate-900 text-white rounded-2xl shadow-xs">
          <BookOpen size={28} />
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="animate-spin text-slate-900" size={18} />
          <span className="text-xs font-semibold tracking-wide">Authenticating & Loading Workspace…</span>
        </div>
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <ErrorBoundary>
      <DashboardPageContent
        initialSubmissions={[]}
        teacherId={currentUser.uid}
        profile={profile}
      />
    </ErrorBoundary>
  );
}
