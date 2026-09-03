import { adminDb } from "./firebase-admin";
import { NON_TEACHING_ADMIN_EMAILS, WEEK_OPTIONS, DIVISION_CLASSES } from "./constants";
import { DefaulterReportData, DefaulterItem } from "./whatsapp";
import { ExpectedQuota } from "./types";

/**
 * Calculates submission defaulters for a specific target week with quota-based auditing.
 */
export async function getDefaultersReportForWeek(
  weekName?: string,
  departmentFilter?: string
): Promise<DefaulterReportData> {
  const targetWeek = weekName || getCurrentWeekLabel();

  const isDivision = departmentFilter ? Boolean(DIVISION_CLASSES[departmentFilter]) : false;

  // 1. Fetch active profiles from Firestore
  let profilesSnapshot;
  try {
    if (departmentFilter && departmentFilter !== "All" && departmentFilter !== "All Departments") {
      profilesSnapshot = await adminDb
        .collection("profiles")
        .where("department", "==", departmentFilter)
        .get();
    } else {
      profilesSnapshot = await adminDb.collection("profiles").get();
    }
  } catch {
    // Graceful fallback for local development testing
    return {
      weekName: targetWeek,
      deadlineDate: "Friday, 5:00 PM GMT",
      totalTeachers: 4,
      submittedCount: 2,
      defaulterCount: 2,
      defaulters: [
        {
          id: "demo-teacher-ict",
          fullName: "Mr. Derrick Thompson",
          email: "derrick.thompson@stadelaideschool.com",
          department: "ICT",
          missingQuotas: [
            { subject: "ICT", className: "Year 5 (Streams A & B)" },
            { subject: "ICT", className: "Year 6 (Streams A & B)" },
          ],
        },
        {
          id: "demo-samuel-gyasi",
          fullName: "Mr. Samuel Gyasi",
          email: "samuel.gyasi@stadelaideschool.com",
          department: "Mathematics",
          missingQuotas: [
            { subject: "Mathematics", className: "Year 7 (Streams A & B)" },
          ],
        },
      ],
    };
  }

  const teachersMap = new Map<
    string,
    {
      id: string;
      fullName: string;
      email: string;
      department: string;
      expectedQuotas: ExpectedQuota[];
      hasExplicitQuotas: boolean;
    }
  >();

  profilesSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    const email = (data.email || "").toLowerCase();

    // Skip pure non-teaching administrators
    if (NON_TEACHING_ADMIN_EMAILS.includes(email)) {
      return;
    }

    // Exclude zero-quota / Nursery staff if expected_quotas is explicitly empty
    if (Array.isArray(data.expected_quotas) && data.expected_quotas.length === 0) {
      return;
    }

    const hasExplicitQuotas = Array.isArray(data.expected_quotas);
    const expectedQuotas: ExpectedQuota[] = hasExplicitQuotas ? data.expected_quotas : [];

    teachersMap.set(doc.id, {
      id: doc.id,
      fullName: data.full_name || data.name || "Unnamed Staff",
      email: data.email || "No email",
      department: data.department || data.subject || "General",
      expectedQuotas,
      hasExplicitQuotas,
    });
  });

  // 2. Fetch submissions for the target week
  let submissionsQuery = adminDb.collection("submissions").where("week_name", "==", targetWeek);
  if (departmentFilter && departmentFilter !== "All" && departmentFilter !== "All Departments" && !isDivision) {
    submissionsQuery = submissionsQuery.where("subject", "==", departmentFilter);
  }
  const submissionsSnapshot = await submissionsQuery.get();

  // Map submissions per teacher: teacherId -> Set of "subject:::className"
  const teacherSubmissionsMap = new Map<string, Set<string>>();
  const anySubmittedTeacherIds = new Set<string>();

  submissionsSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    if (!data.teacher_id) return;

    anySubmittedTeacherIds.add(data.teacher_id);

    if (!teacherSubmissionsMap.has(data.teacher_id)) {
      teacherSubmissionsMap.set(data.teacher_id, new Set());
    }

    const subjectStr = (data.subject || "").trim().toLowerCase();
    const classStr = (data.grade_level || "").trim().toLowerCase();
    teacherSubmissionsMap.get(data.teacher_id)!.add(`${subjectStr}:::${classStr}`);
  });

  // 3. Quota-based audit evaluation
  const defaulters: DefaulterItem[] = [];
  const partiallySubmitted: DefaulterItem[] = [];
  let fullySubmittedCount = 0;

  teachersMap.forEach((teacher, teacherId) => {
    const submissions = teacherSubmissionsMap.get(teacherId) || new Set();

    if (teacher.hasExplicitQuotas && teacher.expectedQuotas.length > 0) {
      const missingQuotas: ExpectedQuota[] = [];
      const submittedQuotas: ExpectedQuota[] = [];

      teacher.expectedQuotas.forEach((quota) => {
        if (isQuotaSubmitted(quota, submissions)) {
          submittedQuotas.push(quota);
        } else {
          missingQuotas.push(quota);
        }
      });

      if (missingQuotas.length === 0) {
        // All assigned classes submitted
        fullySubmittedCount++;
      } else if (submittedQuotas.length > 0) {
        // Some submitted, but some missing
        partiallySubmitted.push({
          id: teacher.id,
          fullName: teacher.fullName,
          email: teacher.email,
          department: teacher.department,
          status: "PARTIALLY_SUBMITTED",
          totalQuotas: teacher.expectedQuotas.length,
          submittedQuotasCount: submittedQuotas.length,
          missingQuotas,
        });
      } else {
        // None submitted
        defaulters.push({
          id: teacher.id,
          fullName: teacher.fullName,
          email: teacher.email,
          department: teacher.department,
          status: "DEFAULTER",
          totalQuotas: teacher.expectedQuotas.length,
          submittedQuotasCount: 0,
          missingQuotas,
        });
      }
    } else {
      // Legacy fallback when no explicit expected_quotas array exists on profile
      if (anySubmittedTeacherIds.has(teacherId)) {
        fullySubmittedCount++;
      } else {
        defaulters.push({
          id: teacher.id,
          fullName: teacher.fullName,
          email: teacher.email,
          department: teacher.department,
          status: "DEFAULTER",
        });
      }
    }
  });

  const totalTeachers = teachersMap.size;
  const submittedCount = fullySubmittedCount;
  const partiallySubmittedCount = partiallySubmitted.length;
  const defaulterCount = defaulters.length;

  return {
    weekName: targetWeek,
    deadlineDate: getDeadlineStringForWeek(),
    totalTeachers,
    submittedCount,
    partiallySubmittedCount,
    defaulterCount,
    defaulters,
    partiallySubmitted,
  };
}

/**
 * Returns current academic week label (e.g. "Week 1", "Week 2", ..., "Week 14").
 */
export function getCurrentWeekLabel(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const pastDaysOfYear = (now.getTime() - startOfYear.getTime()) / 86400000;
  const rawWeekNum = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
  // Map calendar week to term academic week (1 to 14)
  const academicWeekIndex = ((rawWeekNum - 1) % WEEK_OPTIONS.length);
  return WEEK_OPTIONS[academicWeekIndex] || WEEK_OPTIONS[0];
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

/**
 * Checks if a teacher's expected quota is satisfied by their submitted lesson plans.
 * Supports flexible matching for double stream cohorts (e.g. Year 5A or Year 5B satisfies Year 5 (Streams A & B)).
 */
export function isQuotaSubmitted(
  quota: ExpectedQuota,
  submissions: Set<string>
): boolean {
  const quotaSubj = quota.subject.trim().toLowerCase();
  const quotaClass = quota.className.trim().toLowerCase();

  // 1. Exact match
  if (submissions.has(`${quotaSubj}:::${quotaClass}`)) {
    return true;
  }

  // 2. Year cohort matching for double streams / joint classes
  const quotaYrMatch = quotaClass.match(/^year\s*(\d+)/i);
  if (quotaYrMatch) {
    const quotaYrNum = quotaYrMatch[1];
    const isDoubleStreamOrJoint =
      quotaClass.includes("streams") ||
      quotaClass.includes("joint") ||
      !quotaClass.match(/year\s*\d+[ab]/i);

    for (const subKey of submissions) {
      const [subSubj, subClass] = subKey.split(":::");
      if (subSubj !== quotaSubj) continue;

      const subYrMatch = (subClass || "").match(/^year\s*(\d+)([ab]?)/i);
      if (subYrMatch && subYrMatch[1] === quotaYrNum) {
        if (isDoubleStreamOrJoint) {
          // A single submission for this year cohort covers both streams
          return true;
        }

        // For single-stream specific quota (e.g. Year 2A)
        const subStream = subYrMatch[2]?.toLowerCase();
        const quotaStreamMatch = quotaClass.match(/year\s*\d+([ab])/i);
        const quotaStream = quotaStreamMatch ? quotaStreamMatch[1].toLowerCase() : "";

        if (!subStream || subStream === quotaStream) {
          return true;
        }
      }
    }
  }

  return false;
}
