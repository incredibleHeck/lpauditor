import { z } from "zod";

export const submitLessonPlanSchema = z.object({
  fileUrl: z.string().min(1, "File URL is required"),
  filePath: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  weekName: z.string().min(1, "Week name is required"),
  gradeLevel: z.string().min(1, "Grade level is required"),
  teacherId: z.string().min(1, "Teacher ID is required"),
  parentSubmissionId: z.string().optional(),
  version: z.number().int().positive().optional(),
  revisionNotes: z.string().optional(),
});

export type SubmitLessonPlanInput = z.infer<typeof submitLessonPlanSchema>;

export const updateSubmissionDecisionSchema = z.object({
  submissionId: z.string().min(1, "Submission ID is required"),
  decision: z.enum(["APPROVED", "REVISION_REQUESTED", "NEEDS_OBSERVATION"]),
  comments: z.string().optional(),
});

export type UpdateSubmissionDecisionInput = z.infer<typeof updateSubmissionDecisionSchema>;

export const retrySubmissionAuditSchema = z.object({
  submissionId: z.string().min(1, "Submission ID is required"),
});

export type RetrySubmissionAuditInput = z.infer<typeof retrySubmissionAuditSchema>;

export const chatWithAuditorSchema = z.object({
  submissionId: z.string().min(1, "Submission ID is required"),
  history: z.array(
    z.object({
      role: z.enum(["user", "model"]),
      text: z.string(),
    })
  ),
  userMessage: z.string().min(1, "Message cannot be empty"),
});

export type ChatWithAuditorInput = z.infer<typeof chatWithAuditorSchema>;

export const departmentAnalyticsSchema = z.object({
  departmentFilter: z.string().default("All"),
});

export type DepartmentAnalyticsInput = z.infer<typeof departmentAnalyticsSchema>;

export const defaultersReportSchema = z.object({
  weekName: z.string().optional(),
  departmentFilter: z.string().optional(),
});

export type DefaultersReportInput = z.infer<typeof defaultersReportSchema>;
