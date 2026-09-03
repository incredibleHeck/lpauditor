import { getDepartmentAnalytics } from "@/app/actions/ai";

// Mock external dependencies
const mockGetAuthenticatedUser = jest.fn();
jest.mock("@/lib/auth-helpers", () => ({
  getAuthenticatedUser: () => mockGetAuthenticatedUser(),
}));

const mockSubmissionsGet = jest.fn();
const mockAuditsGet = jest.fn();

jest.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: jest.fn((colName: string) => {
      if (colName === "submissions") {
        return {
          where: jest.fn().mockReturnValue({
            get: mockSubmissionsGet,
          }),
          get: mockSubmissionsGet,
        };
      }
      if (colName === "ai_audits") {
        return {
          where: jest.fn().mockReturnValue({
            get: mockAuditsGet,
          }),
          get: mockAuditsGet,
        };
      }
      return {
        get: jest.fn().mockResolvedValue({ docs: [] }),
        where: jest.fn().mockReturnThis(),
      };
    }),
  },
}));

const mockGenerateContent = jest.fn();
jest.mock("@/lib/gemini", () => ({
  getGeminiClient: () => ({
    getGenerativeModel: () => ({
      generateContent: mockGenerateContent,
    }),
  }),
}));

describe("Department Analytics & Sub-70% Integration Suite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => "Executive briefing: The department scored an average of 65% with 2 underperforming plans.",
      },
    });
  });

  it("should include both COMPLETED and RESUBMISSION_REQUIRED statuses in department analytics", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      uid: "admin-1",
      role: "ADMIN",
      department: "Administration",
    });

    // 4 Submissions:
    // 1: COMPLETED (Score: 85%)
    // 2: RESUBMISSION_REQUIRED (Score: 55% - below 70%)
    // 3: PENDING (no audit yet)
    // 4: FAILED
    mockSubmissionsGet.mockResolvedValueOnce({
      docs: [
        {
          id: "sub-1",
          data: () => ({
            status: "COMPLETED",
            subject: "Mathematics",
            grade_level: "Year 7",
          }),
        },
        {
          id: "sub-2",
          data: () => ({
            status: "RESUBMISSION_REQUIRED",
            subject: "Mathematics",
            grade_level: "Year 8",
          }),
        },
        {
          id: "sub-3",
          data: () => ({
            status: "PENDING",
            subject: "Mathematics",
            grade_level: "Year 9",
          }),
        },
        {
          id: "sub-4",
          data: () => ({
            status: "FAILED",
            subject: "Mathematics",
            grade_level: "Year 10",
          }),
        },
      ],
    });

    // Audits for sub-1 and sub-2
    mockAuditsGet.mockResolvedValueOnce({
      docs: [
        {
          data: () => ({
            submission_id: "sub-1",
            score: 85,
            strengths: ["Clear differentiation"],
            flags: [],
          }),
        },
        {
          data: () => ({
            submission_id: "sub-2",
            score: 55,
            strengths: ["Good timing"],
            flags: ["Missing assessment criteria", "Inadequate plenary"],
          }),
        },
      ],
    });

    const result = await getDepartmentAnalytics("Mathematics");

    expect(result.success).toBe(true);
    expect(result.stats).toBeDefined();

    const stats = result.stats!;
    expect(stats.totalCount).toBe(4);
    // Both COMPLETED and RESUBMISSION_REQUIRED count as completed audits
    expect(stats.completedCount).toBe(2);
    expect(stats.pendingCount).toBe(1);
    expect(stats.failedCount).toBe(1);

    // Average score: (85 + 55) / 2 = 70%
    expect(stats.averageScore).toBe(70);

    // sub-2 scored 55% (< 70%), so underperformingCount should be 1
    expect(stats.underperformingCount).toBe(1);
    expect(stats.commonFlags).toContain("Missing assessment criteria");
    expect(stats.commonFlags).toContain("Inadequate plenary");
  });

  it("should ensure sub-70% submissions correctly pull down the average and increment underperformingCount", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      uid: "hod-math",
      role: "HOD",
      department: "Mathematics",
    });

    // Three submissions, two failing (< 70%)
    mockSubmissionsGet.mockResolvedValueOnce({
      docs: [
        {
          id: "sub-10",
          data: () => ({
            status: "COMPLETED",
            subject: "Mathematics",
            grade_level: "Year 5",
          }),
        },
        {
          id: "sub-20",
          data: () => ({
            status: "RESUBMISSION_REQUIRED",
            subject: "Mathematics",
            grade_level: "Year 6",
          }),
        },
        {
          id: "sub-30",
          data: () => ({
            status: "RESUBMISSION_REQUIRED",
            subject: "Mathematics",
            grade_level: "Year 7",
          }),
        },
      ],
    });

    mockAuditsGet.mockResolvedValueOnce({
      docs: [
        {
          data: () => ({
            submission_id: "sub-10",
            score: 90, // Pass
            strengths: ["Exemplary scaffolding"],
            flags: [],
          }),
        },
        {
          data: () => ({
            submission_id: "sub-20",
            score: 60, // Fail (< 70%)
            strengths: [],
            flags: ["Misaligned Cambridge learning objective"],
          }),
        },
        {
          data: () => ({
            submission_id: "sub-30",
            score: 45, // Fail (< 70%)
            strengths: [],
            flags: ["No active learning tasks"],
          }),
        },
      ],
    });

    const result = await getDepartmentAnalytics("Mathematics");

    expect(result.success).toBe(true);
    const stats = result.stats!;
    expect(stats.completedCount).toBe(3);

    // Sum: 90 + 60 + 45 = 195. Average: 195 / 3 = 65%
    expect(stats.averageScore).toBe(65);

    // Two submissions scored below 70%
    expect(stats.underperformingCount).toBe(2);

    // Verify executive briefing contains synthesis details
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    const callArg = mockGenerateContent.mock.calls[0][0];
    expect(callArg).toContain("Average Compliance Score: 65%");
    expect(callArg).toContain("Underperforming Plans (<70%): 2");
  });

  it("should reject unauthorized teachers attempting to access department analytics", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({
      uid: "teacher-1",
      role: "TEACHER",
      department: "Mathematics",
    });

    const result = await getDepartmentAnalytics("Mathematics");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Forbidden/i);
  });
});
