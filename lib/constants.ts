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
] as const;
