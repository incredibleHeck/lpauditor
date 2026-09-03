/**
 * @jest-environment node
 */
import { processLessonPlanAudit, checkAndReportDefaulters } from "@/lib/inngest/functions";
import { SCORE_PASSING_THRESHOLD } from "@/lib/constants";

// Mock filesystem
jest.mock("fs", () => ({
  existsSync: jest.fn().mockReturnValue(true),
  unlinkSync: jest.fn(),
}));

var mockBucketFileDownload = jest.fn().mockResolvedValue(undefined);
var mockBucketFile = jest.fn(() => ({
  download: mockBucketFileDownload,
}));
var mockBucket = jest.fn(() => ({
  file: mockBucketFile,
}));

var mockDocUpdate = jest.fn().mockResolvedValue(undefined);
var mockAuditsAdd = jest.fn().mockResolvedValue({ id: "audit-new-id" });

jest.mock("@/lib/firebase-admin", () => ({
  adminStorage: {
    bucket: () => mockBucket(),
  },
  adminDb: {
    collection: jest.fn((name: string) => {
      if (name === "submissions") {
        return {
          doc: jest.fn(() => ({
            update: mockDocUpdate,
          })),
        };
      }
      if (name === "ai_audits") {
        return {
          add: mockAuditsAdd,
        };
      }
      return {};
    }),
  },
}));

var mockUploadFile = jest.fn();
var mockDeleteFile = jest.fn().mockResolvedValue(undefined);

jest.mock("@google/generative-ai/server", () => ({
  GoogleAIFileManager: jest.fn().mockImplementation(() => ({
    uploadFile: (...args: any[]) => mockUploadFile(...args),
    deleteFile: (...args: any[]) => mockDeleteFile(...args),
  })),
}));

var mockGenerateContent = jest.fn();
jest.mock("@/lib/gemini", () => ({
  getGeminiClient: jest.fn(() => ({
    getGenerativeModel: jest.fn(() => ({
      generateContent: (...args: any[]) => mockGenerateContent(...args),
    })),
  })),
}));


jest.mock("@/lib/defaulters", () => ({
  getDefaultersReportForWeek: jest.fn(),
}));

jest.mock("@/lib/whatsapp", () => ({
  formatDefaultersWhatsAppMessage: jest.fn(),
  sendWhatsAppMessage: jest.fn(),
}));

jest.mock("@/lib/telegram", () => ({
  formatDefaultersTelegramMessage: jest.fn(),
  sendTelegramMessage: jest.fn(),
}));

describe("Inngest Background Audit & Defaulters Pipeline", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockStep = () => ({
    run: jest.fn(async (_name: string, fn: () => Promise<unknown>) => await fn()),
  });

  describe("processLessonPlanAudit", () => {
    const handler = (processLessonPlanAudit as any).fn;

    it("should process a high-scoring plan successfully, commit COMPLETED, and clean up staged file", async () => {
      mockUploadFile.mockResolvedValueOnce({
        file: {
          uri: "https://generativelanguage.googleapis.com/v1beta/files/test-file",
          name: "files/test-file-123",
          mimeType: "application/pdf",
        },
      });

      const passingAuditResponse = {
        score: 88,
        lessons_detected: 2,
        strengths: ["Clear differentiation", "SMART starter verbs"],
        flags: [],
        cambridge_attributes: {
          confident: 90,
          responsible: 85,
          reflective: 80,
          innovative: 85,
          engaged: 90,
        },
        command_verbs: ["Analyze", "Calculate"],
        cognitive_demand: { low_recall: 20, medium_application: 50, high_evaluation: 30 },
        eal_scaffolding_score: 85,
        summary: "Excellent Cambridge aligned plan",
      };

      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify(passingAuditResponse),
        },
      });

      const event = {
        data: {
          submissionId: "sub-pass-1",
          fileUrl: "https://storage.googleapis.com/plan.pdf",
          filePath: "lesson-plans/teacher-1/plan.pdf",
          subject: "Mathematics",
          gradeLevel: "Grade 5",
          teacherId: "teacher-1",
        },
      };

      const step = createMockStep();
      const result = await handler({ event, step });

      expect(result).toEqual({ status: "success", submissionId: "sub-pass-1" });

      // Check Step 0 update to PROCESSING
      expect(mockDocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "PROCESSING",
        })
      );

      // Check Step E save results for COMPLETED (score >= 70)
      expect(mockAuditsAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          submission_id: "sub-pass-1",
          score: 88,
          rubric_type: "CAMBRIDGE",
        })
      );

      expect(mockDocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "COMPLETED",
          requires_resubmission: false,
          score_threshold_met: true,
          hod_decision: null,
        })
      );

      // Check Step D cleanup Gemini staged file
      expect(mockDeleteFile).toHaveBeenCalledWith("files/test-file-123");
    });

    it("should process an under-threshold plan (<70%), flag RESUBMISSION_REQUIRED, and set auto revision decision", async () => {
      mockUploadFile.mockResolvedValueOnce({
        file: {
          uri: "https://generativelanguage.googleapis.com/v1beta/files/test-file-low",
          name: "files/test-file-low",
          mimeType: "application/pdf",
        },
      });

      const failingAuditResponse = {
        score: 55, // strictly < 70
        lessons_detected: 1,
        strengths: ["Good topic choice"],
        flags: ["No assessment for learning", "Missing SMART objectives"],
      };

      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () => JSON.stringify(failingAuditResponse),
        },
      });

      const event = {
        data: {
          submissionId: "sub-fail-1",
          fileUrl: "https://storage.googleapis.com/plan_low.pdf",
          subject: "Primary Science",
          teacherId: "teacher-1",
        },
      };

      const step = createMockStep();
      const result = await handler({ event, step });

      expect(result).toEqual({ status: "success", submissionId: "sub-fail-1" });

      // Check Step E save results for RESUBMISSION_REQUIRED
      expect(mockAuditsAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          submission_id: "sub-fail-1",
          score: 55,
          flags: expect.arrayContaining([
            expect.stringContaining(`below the mandatory ${SCORE_PASSING_THRESHOLD}% threshold`),
          ]),
        })
      );

      expect(mockDocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "RESUBMISSION_REQUIRED",
          requires_resubmission: true,
          score_threshold_met: false,
          hod_decision: "REVISION_REQUESTED",
          hod_feedback: expect.stringContaining(`below the required ${SCORE_PASSING_THRESHOLD}% threshold`),
        })
      );
    });

    it("should handle failure and set status to FAILED in Firestore", async () => {
      mockUploadFile.mockResolvedValueOnce({
        file: {
          uri: "https://generativelanguage.googleapis.com/v1beta/files/test-file-err",
          name: "files/test-file-err",
          mimeType: "application/pdf",
        },
      });
      mockGenerateContent.mockRejectedValueOnce(new Error("Gemini quota exhausted"));

      const event = {
        data: {
          submissionId: "sub-err-1",
          fileUrl: "https://storage.googleapis.com/plan_corrupt.pdf",
          subject: "Art",
          teacherId: "teacher-1",
        },
      };

      const step = createMockStep();

      await expect(handler({ event, step })).rejects.toThrow("Gemini quota exhausted");

      expect(mockDocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "FAILED",
          error_message: "Gemini quota exhausted",
        })
      );
    });
  });


  describe("checkAndReportDefaulters", () => {
    const handler = (checkAndReportDefaulters as any).fn;

    it("should fetch defaulters report and dispatch WhatsApp notification", async () => {
      const { getDefaultersReportForWeek } = require("@/lib/defaulters");
      const { formatDefaultersWhatsAppMessage, sendWhatsAppMessage } = require("@/lib/whatsapp");

      const mockReport = {
        weekName: "Week 5",
        deadlineDate: "Friday, Sep 18, 2026",
        totalTeachers: 15,
        submittedCount: 15,
        defaulterCount: 0,
        defaulters: [],
      };

      getDefaultersReportForWeek.mockResolvedValueOnce(mockReport);
      formatDefaultersWhatsAppMessage.mockReturnValueOnce("🎉 100% compliance!");
      sendWhatsAppMessage.mockResolvedValueOnce({ success: true, messageId: "wa-101" });

      const event = {
        data: { weekName: "Week 5" },
      };

      const step = createMockStep();
      const result = await handler({ event, step });

      expect(result.status).toBe("success");
      expect(result.report).toEqual(mockReport);
      expect(result.whatsAppResult).toEqual({ success: true, messageId: "wa-101" });
      expect(getDefaultersReportForWeek).toHaveBeenCalledWith("Week 5");
      expect(sendWhatsAppMessage).toHaveBeenCalledWith("🎉 100% compliance!");
    });
  });
});
