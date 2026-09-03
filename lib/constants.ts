// ============================================================
// Centralized Constants — School-specific configuration
// ============================================================

export const SCHOOL_NAME = "St. Adelaide International School";
export const SCHOOL_EMAIL_DOMAIN = "@stadelaideschool.com";

/** Admin-level users that always receive ADMIN role regardless of profile. */
export const ADMIN_EMAILS = [
  "princedunyoh@stadelaideschool.com",
  "prince.dunyoh@stadelaideschool.com",
  "theodorahammond@stadelaideschool.com",
  "hectoraryiku@stadelaideschool.com",
];

/** St. Adelaide International School Campus Branches */
export const SCHOOL_BRANCHES = [
  {
    id: "dansoman",
    name: "Dansoman Campus (Pilot)",
    isPilot: true,
    maxLevel: "Lower Secondary (Year 8)",
    principal: "Prince Dunyoh",
    vicePrincipal: "Theodora Hammond",
    description: "Pilot campus running LPAuditor for Term 1 (Nursery to Year 8).",
  },
  {
    id: "sampa",
    name: "Sampa Campus",
    isPilot: false,
    maxLevel: "Upper Secondary (Year 12 / A-Levels)",
    description: "Main secondary campus with classes up to Upper Secondary.",
  },
  {
    id: "aburi",
    name: "Aburi Campus",
    isPilot: false,
    maxLevel: "Lower Secondary (Year 9)",
    description: "Satellite campus running classes up to Lower Secondary.",
  },
] as const;

/** Sectional Heads of Department (General HODs, not subject-specific). */
export const HOD_EMAILS = [
  "pauline.asante-nti@stadelaideschool.com", // Lower Primary (Years 1–3)
  "abigailsackey@stadelaideschool.com",      // Upper Primary (Years 4–6)
  "joana.asiedua.amoh-barimah@stadelaideschool.com", // Lower Secondary (Years 7–8/9)
];

/** Academic Divisions for Dansoman Campus Pilot */
export const ACADEMIC_DIVISIONS = [
  "Lower Primary",
  "Upper Primary",
  "Lower Secondary",
] as const;

export type AcademicDivision = (typeof ACADEMIC_DIVISIONS)[number];

/** Class mappings per academic division at St. Adelaide (Dansoman Campus) */
export const DIVISION_CLASSES: Record<string, string[]> = {
  "Lower Primary": [
    "Year 1",
    "Year 1A",
    "Year 2",
    "Year 2A",
    "Year 2B",
    "Year 2 (Streams A & B)",
    "Year 2 (Joint)",
    "Year 3",
    "Year 3A",
    "Year 3B",
    "Year 3 (Streams A & B)",
    "Year 3 (Joint)",
    "Grade 1",
    "Grade 2",
    "Grade 3",
  ],
  "Upper Primary": [
    "Year 4",
    "Year 4A",
    "Year 4B",
    "Year 4 (Streams A & B)",
    "Year 4 (Joint)",
    "Year 5",
    "Year 5A",
    "Year 5B",
    "Year 5 (Streams A & B)",
    "Year 5 (Joint)",
    "Year 6",
    "Year 6A",
    "Year 6B",
    "Year 6 (Streams A & B)",
    "Year 6 (Joint)",
    "Grade 4",
    "Grade 5",
    "Grade 6",
  ],
  "Lower Secondary": [
    "Year 7",
    "Year 7A",
    "Year 7B",
    "Year 7 (Streams A & B)",
    "Year 7 (Joint)",
    "Year 8",
    "Grade 7 (Stage 8)",
    "Grade 8 (Stage 9)",
    "Grade 9 (IGCSE 1)",
  ],
};

/** Sectional HOD directory linking each division to its general head */
export const SECTIONAL_HOD_MAP: Record<
  string,
  { name: string; email: string; division: string; grades: string }
> = {
  "Lower Primary": {
    name: "Mrs. Pauline Asante-Nti",
    email: "pauline.asante-nti@stadelaideschool.com",
    division: "Lower Primary",
    grades: "Years 1–3",
  },
  "Upper Primary": {
    name: "Mrs. Abigail Sackey",
    email: "abigailsackey@stadelaideschool.com",
    division: "Upper Primary",
    grades: "Years 4–6",
  },
  "Lower Secondary": {
    name: "Mrs. Joana Asiedua Amoh-Barimah",
    email: "joana.asiedua.amoh-barimah@stadelaideschool.com",
    division: "Lower Secondary",
    grades: "Years 7–8 (Dansoman)",
  },
};

/** Pure non-teaching administrators excluded from defaulters tracking. */
export const NON_TEACHING_ADMIN_EMAILS = [
  "princedunyoh@stadelaideschool.com",
  "prince.dunyoh@stadelaideschool.com",
  "theodorahammond@stadelaideschool.com",
];

/** School-Wide Administration Leadership Directory (Dansoman Campus) */
export const ADMIN_LEADERSHIP = [
  {
    name: "Prince Dunyoh",
    title: "Principal (Dansoman Campus)",
    email: "princedunyoh@stadelaideschool.com",
    role: "ADMIN",
    isTeaching: false,
  },
  {
    name: "Theodora Hammond",
    title: "Vice Principal (Dansoman Campus)",
    email: "theodorahammond@stadelaideschool.com",
    role: "ADMIN",
    isTeaching: false,
  },
  {
    name: "Mr. Ayiku (Hector Aryiku)",
    title: "Administrator & Teacher (Primary & Secondary ICT)",
    email: "hectoraryiku@stadelaideschool.com",
    role: "ADMIN",
    isTeaching: true,
  },
] as const;

export const SCHOOL_SUBJECTS = [
  "English",
  "Mathematics",
  "Science",
  "ICT",
  "French",
  "Arts",
  "Music",
  "PE",
  "Robotics",
  "PSHE",
  "Library",
  "Physics",
  "Chemistry",
  "Biology",
  "Literature",
  "History",
  "Geography",
  "Humanities",
  "BK",
  "SEN",
] as const;

export const SCHOOL_CLASSES = [
  "Year 1A",
  "Year 2A",
  "Year 2B",
  "Year 3A",
  "Year 3B",
  "Year 4A",
  "Year 4B",
  "Year 5A",
  "Year 5B",
  "Year 6A",
  "Year 6B",
  "Year 7A",
  "Year 7B",
  "Year 8",
  "Year 2 (Joint)",
  "Year 3 (Joint)",
  "Year 4 (Joint)",
  "Year 5 (Joint)",
  "Year 6 (Joint)",
  "Year 7 (Joint)",
  "Year 2 (Streams A & B)",
  "Year 3 (Streams A & B)",
  "Year 4 (Streams A & B)",
  "Year 5 (Streams A & B)",
  "Year 6 (Streams A & B)",
  "Year 7 (Streams A & B)",
] as const;

export const DEPARTMENTS = [
  "Primary Science",
  "Mathematics",
  "English Language",
  "History",
  "Geography",
  "ICT & Computing",
  "French",
  "Art & Design",
  "Music",
  "Physical Education",
] as const;

export const GRADE_LEVELS = [
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7 (Stage 8)",
  "Grade 8 (Stage 9)",
  "Grade 9 (IGCSE 1)",
  "Grade 10 (IGCSE 2)",
  "Grade 11 (AS Level)",
  "Grade 12 (A Level)",
] as const;

export const WEEK_OPTIONS = [
  "Week 1",
  "Week 2",
  "Week 3",
  "Week 4",
  "Week 5",
  "Week 6",
  "Week 7",
  "Week 8",
  "Week 9",
  "Week 10",
  "Week 11",
  "Week 12",
  "Week 13",
  "Week 14",
] as const;

/**
 * Checks if an email belongs to the official institution domain.
 */
export function isInstitutionalEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(SCHOOL_EMAIL_DOMAIN);
}

/**
 * Checks if an email is an authorized administrative email.
 */
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

/**
 * Checks if an email is an excluded non-teaching admin.
 */
export function isNonTeachingAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return NON_TEACHING_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

/**
 * Compliance scoring thresholds (0-100 scale).
 * 70% threshold represents the required 7.0/10 passing score.
 */
export const SCORE_PASSING_THRESHOLD = 70;
export const SCORE_EXEMPLARY_THRESHOLD = 80;

/**
 * Evaluates whether a compliance score meets or exceeds the mandatory passing threshold.
 */
export function isPassingScore(score?: number | null): boolean {
  if (score === undefined || score === null) return false;
  return score >= SCORE_PASSING_THRESHOLD;
}

/**
 * Google DeepMind Gemini AI Models
 * Upgraded to latest Gemini 3.8 Flash for fast multimodal inference, lower token consumption,
 * and high-fidelity structured JSON rubric validation.
 */
export const GEMINI_AUDIT_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
export const GEMINI_CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-3.8-flash";
export const GEMINI_SYNTHESIS_MODEL = process.env.GEMINI_SYNTHESIS_MODEL || "gemini-3.8-flash";

