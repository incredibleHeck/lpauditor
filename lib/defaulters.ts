import { adminDb } from "./firebase-admin";
import { NON_TEACHING_ADMIN_EMAILS } from "./constants";
import { DefaulterReportData, DefaulterItem } from "./telegram";

/**
 * Calculates submission defaulters for a specific target week.
 */
export async function getDefaultersReportForWeek(
  weekName?: string,
  departmentFilter?: string
): Promise<DefaulterReportData> {
  const targetWeek = weekName || getCurrentWeekLabel();

  // 1. Fetch active profiles from Firestore (teachers, HODs, and dual teacher-admins)
  let profilesSnapshot;
  if (departmentFilter && departmentFilter !== "All") {
    profilesSnapshot = await adminDb
      .collection("profiles")
      .where("department", "==", departmentFilter)
      .get();
  } else {
    profilesSnapshot = await adminDb.collection("profiles").get();
  }

  const teachersMap = new Map<string, { id: string; fullName: string; email: string; department: string }>();

  profilesSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    const email = (data.email || "").toLowerCase();

    // Skip pure non-teaching administrators
    if (NON_TEACHING_ADMIN_EMAILS.includes(email)) {
      return;
    }

    teachersMap.set(doc.id, {
      id: doc.id,
      fullName: data.full_name || data.name || "Unnamed Staff",
      email: data.email || "No email",
      department: data.department || data.subject || "General"
    });
  });

  // 2. Fetch submissions for the target week
  let submissionsQuery = adminDb.collection("submissions").where("week_name", "==", targetWeek);
  if (departmentFilter && departmentFilter !== "All") {
    submissionsQuery = submissionsQuery.where("subject", "==", departmentFilter);
  }
  const submissionsSnapshot = await submissionsQuery.get();

  const submittedTeacherIds = new Set<string>();
  submissionsSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    if (data.teacher_id) {
      submittedTeacherIds.add(data.teacher_id);
    }
  });

  // 3. Identify defaulters
  const defaulters: DefaulterItem[] = [];
  teachersMap.forEach((teacher, teacherId) => {
    if (!submittedTeacherIds.has(teacherId)) {
      defaulters.push(teacher);
    }
  });

  const totalTeachers = teachersMap.size;
  const submittedCount = submittedTeacherIds.size;
  const defaulterCount = defaulters.length;

  return {
    weekName: targetWeek,
    deadlineDate: getDeadlineStringForWeek(),
    totalTeachers,
    submittedCount,
    defaulterCount,
    defaulters
  };
}

/**
 * Returns current week label (e.g. "Week 5 - Term 1" or current calendar week).
 */
export function getCurrentWeekLabel(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const pastDaysOfYear = (now.getTime() - startOfYear.getTime()) / 86400000;
  const weekNum = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
  return `Week ${weekNum}`;
}

/**
 * Returns formatted deadline string (e.g., "Friday, Aug 7, 2026 at 17:00 WAT").
 */
export function getDeadlineStringForWeek(): string {
  const now = new Date();
  const day = now.getDay();
  // Target Friday of the current week (5 = Friday)
  const diffToFriday = (5 - day + 7) % 7;
  const friday = new Date(now);
  friday.setDate(now.getDate() + diffToFriday);
  friday.setHours(17, 0, 0, 0);

  return friday.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
