import {
  submitLessonPlanSchema,
  updateSubmissionDecisionSchema,
  retrySubmissionAuditSchema,
  chatWithAuditorSchema,
  departmentAnalyticsSchema,
  defaultersReportSchema,
} from "@/lib/schemas/actionSchemas";

describe("Action Zod Validation Schemas", () => {
  describe("submitLessonPlanSchema", () => {
    it("should validate valid submission input with versioning", () => {
      const valid = {
        fileUrl: "https://storage.googleapis.com/test.pdf",
        filePath: "lesson-plans/teacher1/test.pdf",
        subject: "Mathematics",
        weekName: "Week 1",
        gradeLevel: "Grade 3",
        teacherId: "teacher-123",
        parentSubmissionId: "parent-sub-001",
        version: 2,
        revisionNotes: "Fixed objectives",
      };

      const result = submitLessonPlanSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject input with missing required fields", () => {
      const invalid = {
        fileUrl: "",
        subject: "",
      };

      const result = submitLessonPlanSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("updateSubmissionDecisionSchema", () => {
    it("should accept valid HOD decision enum values", () => {
      const decisions = ["APPROVED", "REVISION_REQUESTED", "NEEDS_OBSERVATION"] as const;
      for (const decision of decisions) {
        const result = updateSubmissionDecisionSchema.safeParse({
          submissionId: "sub-123",
          decision,
          comments: "Great job",
        });
        expect(result.success).toBe(true);
      }
    });

    it("should reject unknown decision values", () => {
      const result = updateSubmissionDecisionSchema.safeParse({
        submissionId: "sub-123",
        decision: "INVALID_STATUS",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("chatWithAuditorSchema", () => {
    it("should validate proper chat history and user message", () => {
      const valid = {
        submissionId: "sub-123",
        history: [
          { role: "user" as const, text: "How can I improve?" },
          { role: "model" as const, text: "Focus on EAL scaffolding." },
        ],
        userMessage: "What specific activity do you recommend?",
      };

      const result = chatWithAuditorSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject empty user message", () => {
      const invalid = {
        submissionId: "sub-123",
        history: [],
        userMessage: "",
      };

      const result = chatWithAuditorSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});
