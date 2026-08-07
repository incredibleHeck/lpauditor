"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import DashboardPageContent from "@/components/DashboardPageContent";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Loader2, BookOpen } from "lucide-react";
import { SCHOOL_EMAIL_DOMAIN } from "@/lib/constants";
import type { UserProfile } from "@/lib/types";

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/auth/login");
        return;
      }

      const userEmail = (user.email || "").toLowerCase();
      if (!userEmail.endsWith(SCHOOL_EMAIL_DOMAIN)) {
        await auth.signOut();
        router.push("/auth/login");
        return;
      }

      setCurrentUser(user);

      try {
        const docRef = doc(db, "profiles", user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          setProfile({
            full_name: user.displayName || "Teacher",
            role: "TEACHER",
            department: "Primary Science",
          });
        }
      } catch (err) {
        console.error("Failed to load user profile:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col justify-center items-center gap-4 font-sans text-white">
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-500">
          <BookOpen size={36} />
        </div>
        <div className="flex items-center gap-2">
          <Loader2 className="animate-spin text-amber-500" size={20} />
          <span className="text-sm text-zinc-400 font-medium">Authenticating & Loading Workspace...</span>
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
