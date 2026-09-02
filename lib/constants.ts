// ============================================================
// Centralized Constants — School-specific configuration
// ============================================================

export const SCHOOL_NAME = "St. Adelaide International School";
export const SCHOOL_EMAIL_DOMAIN = "@stadelaideschool.com";

/** Admin-level users that always receive ADMIN role regardless of profile. */
export const ADMIN_EMAILS = [
  "theodorahammond@stadelaideschool.com",
  "hectoraryiku@stadelaideschool.com",
  "abigailsackey@stadelaideschool.com",
];

/** Pure non-teaching administrators excluded from defaulters tracking. */
export const NON_TEACHING_ADMIN_EMAILS = [
  "theodorahammond@stadelaideschool.com",
];

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
