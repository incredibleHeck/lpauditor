import { cookies } from "next/headers";
import { adminAuth, adminDb } from "./firebase-admin";
import { ADMIN_EMAILS, SCHOOL_EMAIL_DOMAIN, isInstitutionalEmail, isAdminEmail } from "./constants";

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  role: "TEACHER" | "HOD" | "ADMIN" | string;
  department: string | null;
  full_name?: string;
}

export { ADMIN_EMAILS };

/**
 * Verifies a Firebase ID token and retrieves the authenticated user's profile from Firestore.
 * Throws an error if authentication fails.
 */
export async function getAuthenticatedUser(idToken?: string): Promise<AuthenticatedUser> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie && !idToken) {
    throw new Error("Unauthorized: Missing authentication token.");
  }

  try {
    // Support for Local Dev Sandbox Demo Accounts
    if (sessionCookie && sessionCookie.startsWith("demo:")) {
      const demoKey = sessionCookie.replace("demo:", "");
      if (demoKey === "teacher-ict") {
        return {
          uid: "demo-teacher-ict",
          email: "derrick.thompson@stadelaideschool.com",
          role: "TEACHER",
          department: "ICT",
          full_name: "Mr. Derrick Thompson",
        };
      }
      if (demoKey === "hod" || demoKey === "hod-science") {
        return {
          uid: "demo-hod-science",
          email: "abigailsackey@stadelaideschool.com",
          role: "HOD",
          department: "Upper Primary",
          full_name: "Mrs. Abigail Sackey",
        };
      }
      if (demoKey === "admin") {
        return {
          uid: "demo-admin",
          email: "hectoraryiku@stadelaideschool.com",
          role: "ADMIN",
          department: "Administration",
          full_name: "Mr. Ayiku",
        };
      }
    }

    let decodedToken;
    if (sessionCookie) {
      decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
    } else {
      decodedToken = await adminAuth.verifyIdToken(idToken!);
    }

    const uid = decodedToken.uid;
    const email = (decodedToken.email || "").toLowerCase();

    if (!isInstitutionalEmail(email)) {
      throw new Error(`Forbidden: Access is restricted exclusively to St. Adelaide International School accounts (${SCHOOL_EMAIL_DOMAIN}).`);
    }

    const isAdmin = isAdminEmail(email);
    const profileDoc = await adminDb.collection("profiles").doc(uid).get();
    
    if (profileDoc.exists) {
      const data = profileDoc.data()!;
      const userRole = isAdmin ? "ADMIN" : (data.role || "TEACHER");

      // Auto-heal admin role in Firestore if missing
      if (isAdmin && data.role !== "ADMIN") {
        adminDb.collection("profiles").doc(uid).update({ role: "ADMIN" }).catch(() => {});
      }

      return {
        uid,
        email: email || data.email,
        role: userRole,
        department: data.department || null,
        full_name: data.full_name || "Teacher",
      };
    }

    return {
      uid,
      email: email,
      role: isAdmin ? "ADMIN" : "TEACHER",
      department: null,
      full_name: isAdmin ? "Admin User" : "Teacher",
    };
  } catch (err: unknown) {
    const { logger } = await import("./logger");
    logger.error({ err }, "Authentication verification failed");
    if (err instanceof Error && err.message.includes("Forbidden")) {
      throw err;
    }
    throw new Error("Unauthorized: Invalid session or authentication token.");
  }
}
