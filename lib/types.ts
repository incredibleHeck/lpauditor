// ============================================================
// Shared Types — Single source of truth for all data interfaces
// ============================================================

export interface Audit {
  id: string;
  submission_id: string;
  score: number | null;
  lessons_detected: number | null;
  strengths: string[];
  flags: string[];
  cambridge_attributes?: {
    confident: number;
    responsible: number;
    reflective: number;
    innovative: number;
    engaged: number;
  } | null;
  command_verbs?: string[];
  cognitive_demand?: {
    low_recall: number;
    medium_application: number;
    high_evaluation: number;
  } | null;
  eal_scaffolding_score?: number | null;
  time_compliance?: {
    is_compliant: boolean;
    total_allocated_minutes: number;
    pacing_feedback: string;
  } | null;
  age_appropriateness?: {
    score: number;
    feedback: string;
  } | null;
  instructional_delivery?: {
    teacher_student_ratio: string;
    methodology_notes: string;
    step_by_step_tips: string[];
  } | null;
  raw_response: Record<string, unknown>;
  created_at: string;
}

export interface Submission {
  id: string;
  teacher_id: string;
  file_url: string;
  file_path?: string;
  subject: string;
  week_name: string;
  grade_level: string;
  status: string | null;
  hod_decision?: "APPROVED" | "REVISION_REQUESTED" | "NEEDS_OBSERVATION" | null;
  hod_feedback?: string | null;
  hod_updated_at?: string | null;
  hod_updated_by?: string | null;
  created_at: string;
  ai_audits: Audit[] | Audit | null;
  profiles?: { full_name: string; department: string };
}

export interface SubmissionContext {
  id: string;
  file_url: string;
  file_path?: string;
  subject: string;
  week_name: string;
  grade_level: string;
  status: string | null;
  hod_decision?: "APPROVED" | "REVISION_REQUESTED" | "NEEDS_OBSERVATION" | null;
  hod_feedback?: string | null;
  hod_updated_at?: string | null;
  hod_updated_by?: string | null;
}

export interface UserProfile {
  full_name: string;
  role: "TEACHER" | "HOD" | "ADMIN" | string;
  department: string | null;
}

export type HodDecision = "APPROVED" | "REVISION_REQUESTED" | "NEEDS_OBSERVATION";
export type SubmissionStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
