import { chatWithAuditor, getDepartmentAnalytics } from "@/app/actions/ai";

jest.mock("@/lib/auth-helpers", () => ({
  getAuthenticatedUser: jest.fn(),
}));

const mockSendMessage = jest.fn();
const mockGenerateContent = jest.fn();
const mockChatsCreate = jest.fn(() => ({
  sendMessage: mockSendMessage,
}));

jest.mock("@/lib/gemini", () => ({
  getGeminiClient: jest.fn(() => ({
    chats: {
      create: mockChatsCreate,
    },
    models: {
      generateContent: mockGenerateContent,
    },
  })),
}));

const mockSubmissionDocGet = jest.fn();
const mockAuditQueryGet = jest.fn();
const mockSubmissionsQueryGet = jest.fn();

jest.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: jest.fn((colName: string) => {
      if (colName === "submissions") {
        return {
          doc: jest.fn(() => ({
            get: mockSubmissionDocGet,
          })),
          where: jest.fn().mockReturnThis(),
          get: mockSubmissionsQueryGet,
        };
      }
      if (colName === "ai_audits") {
        return {
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          get: mockAuditQueryGet,
        };
      }
      return {};
    }),
  },
}));

jest.mock("@/app/actions/submissions", () => ({
  fetchAuditsForSubmissions: jest.fn(),
}));

describe("AI Server Actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("chatWithAuditor", () => {
    it("should reject invalid inputs with validation error", async () => {
      const result = await chatWithAuditor("", [], "");
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Validation Error/);
    });

    it("should reject non-owners and non-assigned HODs", async () => {
      const { getAuthenticatedUser } = require("@/lib/auth-helpers");
      getAuthenticatedUser.mockResolvedValue({
        uid: "user-2",
        role: "TEACHER",
        department: "Mathematics",
      });

      mockSubmissionDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          teacher_id: "user-1", // belongs to user-1
          subject: "Primary Science",
          grade_level: "Grade 3",
          week_name: "Week 2",
        }),
      });

      const result = await chatWithAuditor("sub-1", [], "How can I improve?");
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Forbidden/);
    });

    it("should return error if submission is not found", async () => {
      const { getAuthenticatedUser } = require("@/lib/auth-helpers");
      getAuthenticatedUser.mockResolvedValue({
        uid: "user-1",
        role: "TEACHER",
      });

      mockSubmissionDocGet.mockResolvedValue({
        exists: false,
      });

      const result = await chatWithAuditor("sub-nonexistent", [], "Hello");
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Submission not found/);
    });

    it("should return error if no audit report exists for submission", async () => {
      const { getAuthenticatedUser } = require("@/lib/auth-helpers");
      getAuthenticatedUser.mockResolvedValue({
        uid: "user-1",
        role: "TEACHER",
        department: "Mathematics",
      });

      mockSubmissionDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          teacher_id: "user-1",
          subject: "Mathematics",
          grade_level: "Grade 4",
          week_name: "Week 1",
        }),
      });

      mockAuditQueryGet.mockResolvedValue({
        empty: true,
        docs: [],
      });

      const result = await chatWithAuditor("sub-1", [], "Hello");
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/No audit report found/);
    });

    it("should sanitize history, call Gemini 3.7 Flash, and return reply", async () => {
      const { getAuthenticatedUser } = require("@/lib/auth-helpers");
      getAuthenticatedUser.mockResolvedValue({
        uid: "user-1",
        role: "TEACHER",
        department: "Mathematics",
      });

      mockSubmissionDocGet.mockResolvedValue({
        exists: true,
        data: () => ({
          teacher_id: "user-1",
          subject: "Mathematics",
          grade_level: "Grade 4",
          week_name: "Week 1",
        }),
      });

      mockAuditQueryGet.mockResolvedValue({
        empty: false,
        docs: [
          {
            data: () => ({
              score: 85,
              lessons_detected: 2,
              strengths: ["Clear SMART verbs"],
              flags: [],
              raw_response: { summary: "Well-structured plan" },
            }),
          },
        ],
      });

      mockSendMessage.mockResolvedValue({
        text: "Here are some concrete suggestions for math scaffolding...",
      });

      const history = [
        { role: "user" as const, text: "Previous question" },
        { role: "model" as const, text: "Previous answer" },
      ];

      const result = await chatWithAuditor("sub-1", history, "How do I scaffold fractions?");
      expect(result.success).toBe(true);
      expect(result.reply).toContain("scaffolding");
      expect(mockChatsCreate).toHaveBeenCalled();
      expect(mockSendMessage).toHaveBeenCalledWith({ message: "How do I scaffold fractions?" });
    });
  });

  describe("getDepartmentAnalytics", () => {
    it("should prevent HOD from accessing analytics of another department", async () => {
      const { getAuthenticatedUser } = require("@/lib/auth-helpers");
      getAuthenticatedUser.mockResolvedValue({
        uid: "hod-math",
        role: "HOD",
        department: "Mathematics",
      });

      const result = await getDepartmentAnalytics("Primary Science");
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Forbidden/);
    });

    it("should allow ADMIN to access any department and calculate metrics", async () => {
      const { getAuthenticatedUser } = require("@/lib/auth-helpers");
      const { fetchAuditsForSubmissions } = require("@/app/actions/submissions");

      getAuthenticatedUser.mockResolvedValue({
        uid: "admin-1",
        role: "ADMIN",
        department: "Administration",
      });

      mockSubmissionsQueryGet.mockResolvedValue({
        docs: [
          { id: "sub-1", data: () => ({ status: "COMPLETED", subject: "Mathematics" }) },
          { id: "sub-2", data: () => ({ status: "COMPLETED", subject: "Mathematics" }) },
          { id: "sub-3", data: () => ({ status: "PENDING", subject: "Mathematics" }) },
        ],
      });

      fetchAuditsForSubmissions.mockResolvedValue({
        "sub-1": { score: 80, strengths: ["Good pacing"], flags: ["Needs starter"] },
        "sub-2": { score: 60, strengths: ["Clear objectives"], flags: ["Needs starter", "Time mismatch"] },
      });

      mockGenerateContent.mockResolvedValue({
        text: "Executive Briefing: Overall 70% average score with strong objectives.",
      });

      const result = await getDepartmentAnalytics("Mathematics");

      expect(result.success).toBe(true);
      expect(result.stats?.totalCount).toBe(3);
      expect(result.stats?.completedCount).toBe(2);
      expect(result.stats?.pendingCount).toBe(1);
      expect(result.stats?.averageScore).toBe(70); // (80 + 60) / 2 = 70
      expect(result.stats?.underperformingCount).toBe(1); // score 60 < 70
      expect(result.stats?.commonFlags).toContain("Needs starter");
      expect(result.brief).toContain("Executive Briefing");
    });

    it("should include RESUBMISSION_REQUIRED plans in underperforming metrics and average score", async () => {
      const { getAuthenticatedUser } = require("@/lib/auth-helpers");
      const { fetchAuditsForSubmissions } = require("@/app/actions/submissions");

      getAuthenticatedUser.mockResolvedValue({
        uid: "hod-math",
        role: "HOD",
        department: "Mathematics",
      });

      mockSubmissionsQueryGet.mockResolvedValue({
        docs: [
          { id: "sub-pass", data: () => ({ status: "COMPLETED", subject: "Mathematics" }) },
          { id: "sub-fail", data: () => ({ status: "RESUBMISSION_REQUIRED", subject: "Mathematics" }) },
        ],
      });

      fetchAuditsForSubmissions.mockResolvedValue({
        "sub-pass": { score: 90, strengths: ["Excellent differentiation"], flags: [] },
        "sub-fail": { score: 50, strengths: [], flags: ["Lacks AfL", "No time pacing"] },
      });

      mockGenerateContent.mockResolvedValue({
        text: "Executive Briefing: Address AfL and time pacing in underperforming plans.",
      });

      const result = await getDepartmentAnalytics("Mathematics");
      expect(result.success).toBe(true);
      expect(result.stats?.totalCount).toBe(2);
      expect(result.stats?.completedCount).toBe(2);
      expect(result.stats?.underperformingCount).toBe(1);
      expect(result.stats?.averageScore).toBe(70); // (90 + 50) / 2 = 70
      expect(result.stats?.commonFlags).toContain("Lacks AfL");
    });

    it("should handle empty submissions gracefully without calling Gemini model", async () => {
      const { getAuthenticatedUser } = require("@/lib/auth-helpers");
      const { fetchAuditsForSubmissions } = require("@/app/actions/submissions");

      getAuthenticatedUser.mockResolvedValue({
        uid: "hod-math",
        role: "HOD",
        department: "Mathematics",
      });

      mockSubmissionsQueryGet.mockResolvedValue({
        docs: [],
      });

      fetchAuditsForSubmissions.mockResolvedValue({});

      const result = await getDepartmentAnalytics("Mathematics");

      expect(result.success).toBe(true);
      expect(result.stats?.totalCount).toBe(0);
      expect(result.stats?.completedCount).toBe(0);
      expect(result.brief).toContain("No department submissions have been successfully audited yet");
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });
  });
});
