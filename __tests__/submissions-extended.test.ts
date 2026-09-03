import {
  fetchAuditsForSubmissions,
  getUserSubmissions,
  getSubmissionStatus,
  getDepartmentSubmissions,
  updateSubmissionDecision,
  retrySubmissionAudit,
} from "@/app/actions/submissions";

jest.mock("@/lib/auth-helpers", () => ({
  getAuthenticatedUser: jest.fn(),
}));

const mockSubmissionsDocGet = jest.fn();
const mockSubmissionsDocUpdate = jest.fn().mockResolvedValue(undefined);
const mockSubmissionsQueryGet = jest.fn();
const mockAuditsQueryGet = jest.fn();
const mockProfilesDocGet = jest.fn();

jest.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: jest.fn((name: string) => {
      if (name === "submissions") {
        return {
          doc: jest.fn(() => ({
            get: mockSubmissionsDocGet,
            update: mockSubmissionsDocUpdate,
          })),
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          get: mockSubmissionsQueryGet,
        };
      }
      if (name === "ai_audits") {
        return {
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          get: mockAuditsQueryGet,
        };
      }
      if (name === "profiles") {
        return {
          doc: jest.fn(() => ({
            get: mockProfilesDocGet,
          })),
        };
      }
      return {};
    }),
  },
}));

jest.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: jest.fn().mockResolvedValue({}),
  },
}));

describe("Submissions Extended Server Actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("fetchAuditsForSubmissions", () => {
    it("should return empty object when passed empty array", async () => {
      const result = await fetchAuditsForSubmissions([]);
      expect(result).toEqual({});
    });

    it("should query Firestore and map audit records by submission_id", async () => {
      mockAuditsQueryGet.mockResolvedValueOnce({
        docs: [
          {
            id: "audit-1",
            data: () => ({ submission_id: "sub-1", score: 85, subject: "Math" }),
          },
          {
            id: "audit-2",
            data: () => ({ submission_id: "sub-2", score: 92, subject: "Science" }),
          },
        ],
      });

      const result = await fetchAuditsForSubmissions(["sub-1", "sub-2"]);
      expect(result["sub-1"]).toBeDefined();
      expect(result["sub-1"].score).toBe(85);
      expect(result["sub-2"]).toBeDefined();
      expect(result["sub-2"].score).toBe(92);
    });

    it("should chunk requests larger than 30 IDs into multiple queries", async () => {
      const ids = Array.from({ length: 35 }, (_, i) => `sub-${i}`);
      mockAuditsQueryGet.mockResolvedValue({ docs: [] });

      await fetchAuditsForSubmissions(ids);
      expect(mockAuditsQueryGet).toHaveBeenCalledTimes(2); // 1st chunk (30) + 2nd chunk (5)
    });
  });

  describe("getUserSubmissions", () => {
    it("should reject unauthorized user trying to view another teacher's submissions", async () => {
      const { getAuthenticatedUser } = require("@/lib/auth-helpers");
      getAuthenticatedUser.mockResolvedValue({ uid: "teacher-2", role: "TEACHER" });

      const result = await getUserSubmissions("teacher-1");
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Forbidden/);
    });

    it("should return teacher submissions merged with AI audits", async () => {
      const { getAuthenticatedUser } = require("@/lib/auth-helpers");
      getAuthenticatedUser.mockResolvedValue({ uid: "teacher-1", role: "TEACHER" });

      mockSubmissionsQueryGet.mockResolvedValueOnce({
        docs: [
          {
            id: "sub-100",
            data: () => ({ teacher_id: "teacher-1", subject: "Math", status: "COMPLETED" }),
          },
        ],
      });

      mockAuditsQueryGet.mockResolvedValueOnce({
        docs: [
          {
            id: "audit-100",
            data: () => ({ submission_id: "sub-100", score: 88 }),
          },
        ],
      });

      const result = await getUserSubmissions("teacher-1");
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("sub-100");
      expect(result.data[0].ai_audits[0].score).toBe(88);
    });
  });

  describe("getSubmissionStatus", () => {
    it("should return error if submission does not exist", async () => {
      const { getAuthenticatedUser } = require("@/lib/auth-helpers");
      getAuthenticatedUser.mockResolvedValue({ uid: "teacher-1", role: "TEACHER" });
      mockSubmissionsDocGet.mockResolvedValueOnce({ exists: false });

      const result = await getSubmissionStatus("sub-nonexistent");
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Submission not found/);
    });

    it("should reject user if they are neither owner nor assigned HOD/Admin", async () => {
      const { getAuthenticatedUser } = require("@/lib/auth-helpers");
      getAuthenticatedUser.mockResolvedValue({
        uid: "teacher-2",
        role: "TEACHER",
        department: "English",
      });

      mockSubmissionsDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ teacher_id: "teacher-1", subject: "Mathematics" }),
      });

      const result = await getSubmissionStatus("sub-1");
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Forbidden/);
    });

    it("should return submission and audit status for owner", async () => {
      const { getAuthenticatedUser } = require("@/lib/auth-helpers");
      getAuthenticatedUser.mockResolvedValue({ uid: "teacher-1", role: "TEACHER" });

      mockSubmissionsDocGet.mockResolvedValueOnce({
        exists: true,
        id: "sub-1",
        data: () => ({ teacher_id: "teacher-1", subject: "Mathematics", status: "COMPLETED" }),
      });

      mockAuditsQueryGet.mockResolvedValueOnce({
        empty: false,
        docs: [{ id: "audit-1", data: () => ({ score: 90 }) }],
      });

      const result = await getSubmissionStatus("sub-1");
      expect(result.success).toBe(true);
      expect(result.data?.ai_audits).toHaveLength(1);
      expect((result.data?.ai_audits[0] as Record<string, unknown>)?.score).toBe(90);
    });
  });

  describe("getDepartmentSubmissions", () => {
    it("should reject HOD accessing different department", async () => {
      const { getAuthenticatedUser } = require("@/lib/auth-helpers");
      getAuthenticatedUser.mockResolvedValue({
        uid: "hod-1",
        role: "HOD",
        department: "Mathematics",
      });

      const result = await getDepartmentSubmissions("Primary Science");
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Forbidden/);
    });

    it("should return department submissions with profiles and audits for assigned HOD", async () => {
      const { getAuthenticatedUser } = require("@/lib/auth-helpers");
      getAuthenticatedUser.mockResolvedValue({
        uid: "hod-1",
        role: "HOD",
        department: "Mathematics",
      });

      mockSubmissionsQueryGet.mockResolvedValueOnce({
        docs: [
          {
            id: "sub-1",
            data: () => ({ teacher_id: "teacher-1", subject: "Mathematics" }),
          },
        ],
      });

      mockProfilesDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ full_name: "Alice Math", department: "Mathematics" }),
      });

      mockAuditsQueryGet.mockResolvedValueOnce({
        docs: [{ id: "audit-1", data: () => ({ submission_id: "sub-1", score: 85 }) }],
      });

      const result = await getDepartmentSubmissions("Mathematics");
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].profiles?.full_name).toBe("Alice Math");
      expect(result.data[0].ai_audits[0]?.score).toBe(85);
    });
  });

  describe("updateSubmissionDecision cross-department security", () => {
    it("should reject HOD attempting to update decision for another department", async () => {
      const { getAuthenticatedUser } = require("@/lib/auth-helpers");
      getAuthenticatedUser.mockResolvedValue({
        uid: "hod-math",
        role: "HOD",
        department: "Mathematics",
      });

      mockSubmissionsDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ subject: "Primary Science", status: "COMPLETED" }),
      });

      const result = await updateSubmissionDecision({
        submissionId: "sub-science",
        decision: "REVISION_REQUESTED",
        comments: "Needs work",
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Forbidden: Only assigned HODs/);
      expect(mockSubmissionsDocUpdate).not.toHaveBeenCalled();
    });
  });

  describe("retrySubmissionAudit", () => {
    it("should reject invalid submission ID", async () => {
      const result = await retrySubmissionAudit({ submissionId: "" });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Validation Error/);
    });

    it("should block non-owner/non-HOD user from retrying audit", async () => {
      const { getAuthenticatedUser } = require("@/lib/auth-helpers");
      getAuthenticatedUser.mockResolvedValue({ uid: "teacher-2", role: "TEACHER" });

      mockSubmissionsDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ teacher_id: "teacher-1", subject: "Math" }),
      });

      const result = await retrySubmissionAudit({ submissionId: "sub-1" });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Forbidden/);
    });

    it("should reset submission status to PENDING and trigger Inngest event", async () => {
      const { getAuthenticatedUser } = require("@/lib/auth-helpers");
      const { inngest } = require("@/lib/inngest/client");

      getAuthenticatedUser.mockResolvedValue({ uid: "teacher-1", role: "TEACHER" });

      mockSubmissionsDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          teacher_id: "teacher-1",
          subject: "Mathematics",
          file_url: "https://storage.googleapis.com/plan.pdf",
          week_name: "Week 1",
          grade_level: "Grade 5",
          version: 1,
        }),
      });

      const result = await retrySubmissionAudit({ submissionId: "sub-1" });
      expect(result.success).toBe(true);
      expect(mockSubmissionsDocUpdate).toHaveBeenCalledWith({
        status: "PENDING",
        error_message: null,
      });
      expect(inngest.send).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "lesson_plan.uploaded",
          data: expect.objectContaining({ submissionId: "sub-1", subject: "Mathematics" }),
        })
      );
    });
  });
});
