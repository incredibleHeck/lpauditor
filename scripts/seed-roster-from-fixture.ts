import fs from "fs";
import path from "path";
import { adminDb } from "../lib/firebase-admin";
import { ExpectedQuota, UserProfile } from "../lib/types";

interface FixtureSubject {
  id: string;
  name: string;
}

interface FixtureDepartment {
  id: string;
  name: string;
}

interface FixtureTeacher {
  id: string;
  name: string;
  departmentIds?: string[];
  specialtyIds?: string[];
}

interface FixtureCurriculum {
  id: string;
  subjectId: string;
  periodsPerWeek: number;
  assignedTeacherId?: string;
}

interface FixtureClass {
  id: string;
  name: string;
  departmentId?: string;
  curriculum?: FixtureCurriculum[];
}

interface FixtureJointClass {
  id: string;
  name: string;
  subjectId: string;
  classIds: string[];
  teacherId: string;
}

interface FixtureData {
  subjects?: FixtureSubject[];
  departments?: FixtureDepartment[];
  teachers?: FixtureTeacher[];
  classes?: FixtureClass[];
  jointClasses?: FixtureJointClass[];
}

export interface ExtractedTeacherRecord {
  id: string;
  name: string;
  email: string;
  role: "TEACHER" | "HOD" | "ADMIN" | string;
  roles: string[];
  department: string;
  assigned_subjects: string[];
  assigned_classes: string[];
  expected_quotas: ExpectedQuota[];
  total_periods: number;
}

/**
 * Known administrative and leadership overrides
 */
const SPECIAL_OVERRIDES: Record<
  string,
  { email?: string; role?: string; roles?: string[]; department?: string }
> = {
  "Mr. Ayiku": {
    email: "hectoraryiku@stadelaideschool.com",
    role: "ADMIN",
    roles: ["TEACHER", "ADMIN"],
    department: "ICT",
  },
  // Sectional HOD: Lower Primary (Years 1–3)
  "Mrs. Pauline Asante-Nti": {
    email: "pauline.asante-nti@stadelaideschool.com",
    role: "HOD",
    roles: ["TEACHER", "HOD"],
    department: "Lower Primary",
  },
  // Sectional HOD: Upper Primary (Years 4–6)
  "Mrs. Abigail Sackey": {
    email: "abigailsackey@stadelaideschool.com",
    role: "HOD",
    roles: ["TEACHER", "HOD"],
    department: "Upper Primary",
  },
  // Sectional HOD: Lower Secondary (Years 7–8/9)
  "Mrs. Joana Asiedua Amoh-Barimah": {
    email: "joana.asiedua.amoh-barimah@stadelaideschool.com",
    role: "HOD",
    roles: ["TEACHER", "HOD"],
    department: "Lower Secondary",
  },
  // School-Wide Administration Leadership (Dansoman Campus)
  "Prince Dunyoh": {
    email: "princedunyoh@stadelaideschool.com",
    role: "ADMIN",
    roles: ["ADMIN"],
    department: "Administration",
  },
  "Theodora Hammond": {
    email: "theodorahammond@stadelaideschool.com",
    role: "ADMIN",
    roles: ["ADMIN"],
    department: "Administration",
  },
};

/**
 * Normalizes teacher name to official @stadelaideschool.com email
 */
export function deriveEmailFromName(name: string): string {
  if (SPECIAL_OVERRIDES[name]?.email) {
    return SPECIAL_OVERRIDES[name].email!;
  }
  const cleanName = name
    .replace(/^(Mr\.|Mrs\.|Miss|Ms\.)\s+/i, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".");
  return `${cleanName}@stadelaideschool.com`;
}

/**
 * Parses rules-check.json fixture into structured faculty records
 */
export function parseFacultyFromFixture(fixturePath: string): {
  activeFaculty: ExtractedTeacherRecord[];
  zeroQuotaFaculty: ExtractedTeacherRecord[];
} {
  const content = fs.readFileSync(fixturePath, "utf-8");
  const raw = JSON.parse(content);
  const data: FixtureData = raw.data || raw;

  const subjectMap = new Map((data.subjects || []).map((s) => [s.id, s.name]));
  const deptMap = new Map((data.departments || []).map((d) => [d.id, d.name]));

  // Build Joint Class lookup map: (teacherId::subjectId::classId) -> friendlyJointClassName
  const jointClassMap = new Map<string, string>();
  (data.jointClasses || []).forEach((jc) => {
    const match = jc.name.match(/^YR(\d+)/i);
    const friendlyName = match ? `Year ${match[1]} (Joint)` : jc.name;
    (jc.classIds || []).forEach((classId) => {
      jointClassMap.set(`${jc.teacherId}::${jc.subjectId}::${classId}`, friendlyName);
    });
  });

  // Initialize teacher map
  const teacherAllocations = new Map<
    string,
    {
      id: string;
      name: string;
      department: string;
      assignments: { subject: string; className: string; periods: number }[];
    }
  >();

  (data.teachers || []).forEach((t) => {
    const primaryDept =
      (t.departmentIds || [])
        .map((id) => deptMap.get(id))
        .filter(Boolean)[0] || "General";

    // Nursery teachers are exempted and excluded from the system for now
    if (primaryDept === "Nursery") return;

    teacherAllocations.set(t.id, {
      id: t.id,
      name: t.name,
      department: primaryDept,
      assignments: [],
    });
  });

  // Traverse classes and map curriculum with joint class resolution
  (data.classes || []).forEach((c) => {
    (c.curriculum || []).forEach((curr) => {
      if (!curr.assignedTeacherId) return;
      const teacher = teacherAllocations.get(curr.assignedTeacherId);
      if (!teacher) return;

      const subjectName = subjectMap.get(curr.subjectId) || curr.subjectId;
      const jointKey = `${curr.assignedTeacherId}::${curr.subjectId}::${c.id}`;
      const className = jointClassMap.get(jointKey) || c.name;

      teacher.assignments.push({
        subject: subjectName,
        className,
        periods: curr.periodsPerWeek || 0,
      });
    });
  });

  const activeFaculty: ExtractedTeacherRecord[] = [];
  const zeroQuotaFaculty: ExtractedTeacherRecord[] = [];

  teacherAllocations.forEach((t) => {
    const override = SPECIAL_OVERRIDES[t.name] || {};
    const email = deriveEmailFromName(t.name);
    const role = override.role || "TEACHER";
    const roles = override.roles || [role];
    const department = override.department || t.department;

    // Group assignments by subject to identify double streams taught by the same teacher
    const subjectClassesMap = new Map<string, Set<string>>();
    let totalPeriods = 0;

    t.assignments.forEach((a) => {
      if (!subjectClassesMap.has(a.subject)) {
        subjectClassesMap.set(a.subject, new Set());
      }
      subjectClassesMap.get(a.subject)!.add(a.className);
      totalPeriods += a.periods;
    });

    const expected_quotas: ExpectedQuota[] = [];

    subjectClassesMap.forEach((classesSet, subject) => {
      const classList = Array.from(classesSet);

      // Group classes by Year cohort (e.g. "Year 2A" and "Year 2B" -> Year "2")
      const yearCohortMap = new Map<string, string[]>();
      const otherClasses: string[] = [];

      classList.forEach((className) => {
        const match = className.match(/^Year\s*(\d+)/i);
        if (match) {
          const yearNum = match[1];
          if (!yearCohortMap.has(yearNum)) {
            yearCohortMap.set(yearNum, []);
          }
          yearCohortMap.get(yearNum)!.push(className);
        } else {
          otherClasses.push(className);
        }
      });

      // Process year cohorts:
      yearCohortMap.forEach((classes, yearNum) => {
        if (classes.length > 1) {
          // The teacher teaches multiple streams of this same year cohort for this subject.
          // They submit ONLY ONE lesson plan to cover both streams of that year class.
          expected_quotas.push({
            subject,
            className: `Year ${yearNum} (Streams A & B)`,
          });
        } else {
          // Teacher only teaches a single stream or single class for this year
          expected_quotas.push({
            subject,
            className: classes[0],
          });
        }
      });

      otherClasses.forEach((className) => {
        expected_quotas.push({ subject, className });
      });
    });
    const assigned_subjects = Array.from(new Set(expected_quotas.map((q) => q.subject)));
    const assigned_classes = Array.from(new Set(expected_quotas.map((q) => q.className)));

    const record: ExtractedTeacherRecord = {
      id: t.id,
      name: t.name,
      email,
      role,
      roles,
      department,
      assigned_subjects,
      assigned_classes,
      expected_quotas,
      total_periods: totalPeriods,
    };

    if (expected_quotas.length > 0) {
      activeFaculty.push(record);
    }
  });

  // Ensure non-teaching leadership administrators (Principal & Vice Principal) are registered
  const leadershipAdmins: ExtractedTeacherRecord[] = [
    {
      id: "admin-prince-dunyoh",
      name: "Prince Dunyoh",
      email: "princedunyoh@stadelaideschool.com",
      role: "ADMIN",
      roles: ["ADMIN"],
      department: "Administration",
      assigned_subjects: [],
      assigned_classes: [],
      expected_quotas: [],
      total_periods: 0,
    },
    {
      id: "admin-theodora-hammond",
      name: "Theodora Hammond",
      email: "theodorahammond@stadelaideschool.com",
      role: "ADMIN",
      roles: ["ADMIN"],
      department: "Administration",
      assigned_subjects: [],
      assigned_classes: [],
      expected_quotas: [],
      total_periods: 0,
    },
  ];

  leadershipAdmins.forEach((admin) => {
    const alreadyExists = [...activeFaculty, ...zeroQuotaFaculty].some(
      (f) => f.name.toLowerCase() === admin.name.toLowerCase()
    );
    if (!alreadyExists) {
      zeroQuotaFaculty.push(admin);
    }
  });

  return { activeFaculty, zeroQuotaFaculty };
}

/**
 * Main Execution Entry Point
 */
async function main() {
  const isDryRun = process.argv.includes("--dry-run");

  // Locate fixture file
  const localFixture = path.join(
    __dirname,
    "diagnostics/fixtures/local/rules-check.json"
  );
  const fallbackFixture = "C:\\EduScheduler\\scripts\\diagnostics\\fixtures\\local\\rules-check.json";
  const fixturePath = fs.existsSync(localFixture)
    ? localFixture
    : fs.existsSync(fallbackFixture)
    ? fallbackFixture
    : null;

  if (!fixturePath) {
    console.error("❌ Error: Could not find rules-check.json fixture file.");
    process.exit(1);
  }

  console.log(`\n=============================================================`);
  console.log(`🏫 ST. ADELAIDE CURRICULUM SEEDING & ALLOCATION ENGINE`);
  console.log(`📁 Source Fixture: ${fixturePath}`);
  console.log(`⚙️  Mode: ${isDryRun ? "DRY-RUN (Simulated)" : "LIVE FIRESTORE SEED"}`);
  console.log(`=============================================================\n`);

  const { activeFaculty, zeroQuotaFaculty } = parseFacultyFromFixture(fixturePath);

  console.log(`📊 ACTIVE TEACHING FACULTY ALLOCATIONS (${activeFaculty.length} Teachers):\n`);
  
  const displayTable = activeFaculty.map((t) => ({
    Name: t.name,
    Email: t.email,
    Role: t.role,
    Department: t.department,
    Subjects: t.assigned_subjects.join(", "),
    ClassesCount: t.assigned_classes.length,
    WeeklyQuotas: t.expected_quotas.length,
    TotalPeriods: t.total_periods,
  }));

  console.table(displayTable);

  console.log(`\n👶 ZERO-QUOTA / NURSERY / SUPPORT FACULTY (${zeroQuotaFaculty.length} Staff):`);
  console.log(
    zeroQuotaFaculty.map((t) => `${t.name} (${t.department})`).join(", ")
  );

  // Save extracted JSON for project reference
  const outputPath = path.join(process.cwd(), "faculty_roster_extracted.json");
  fs.writeFileSync(
    outputPath,
    JSON.stringify({ activeFaculty, zeroQuotaFaculty }, null, 2)
  );
  console.log(`\n💾 Saved full allocation matrix to: ${outputPath}`);

  if (isDryRun) {
    console.log(`\n✅ Dry run completed successfully. No Firestore writes performed.`);
    return;
  }

  // Live Firestore Upsert
  console.log(`\n🚀 Upserting faculty profiles into Cloud Firestore...`);
  const batch = adminDb.batch();
  let count = 0;

  for (const t of activeFaculty) {
    // 1. Write to profiles collection using teacher ID as fallback or keyed by derived email
    const profileRef = adminDb.collection("profiles").doc(t.id);
    const profileData: UserProfile & Record<string, unknown> = {
      id: t.id,
      full_name: t.name,
      email: t.email,
      role: t.role,
      department: t.department,
      assigned_subjects: t.assigned_subjects,
      assigned_classes: t.assigned_classes,
      expected_quotas: t.expected_quotas,
    };
    batch.set(profileRef, profileData, { merge: true });

    // 2. Also mirror to faculty collection for dedicated timetable queries
    const facultyRef = adminDb.collection("faculty").doc(t.id);
    batch.set(facultyRef, t, { merge: true });
    count++;
  }

  await batch.commit();
  console.log(`✅ Successfully seeded ${count} faculty profiles to Firestore!`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal Error during roster seeding:", err);
    process.exit(1);
  });
}
