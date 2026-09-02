import { submitLessonPlan } from "../app/actions/submissions";

jest.mock("../lib/auth-helpers", () => ({
  getAuthenticatedUser: jest.fn(),
}));

jest.mock("../lib/firebase-admin", () => ({
  adminDb: {
    collection: jest.fn().mockReturnThis(),
    add: jest.fn().mockResolvedValue({ id: "mock-submission-id" }),
    doc: jest.fn().mockReturnValue({
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({ version: 1 }),
      }),
    }),
  },
}));

jest.mock("../lib/inngest/client", () => ({
  inngest: {
    send: jest.fn().mockResolvedValue({}),
  },
}));

describe("Submissions Actions", () => {
  it("should prevent user from submitting on behalf of someone else", async () => {
    const { getAuthenticatedUser } = require("../lib/auth-helpers");
    getAuthenticatedUser.mockResolvedValue({ uid: "user1", role: "TEACHER" });

    const result = await submitLessonPlan({
      fileUrl: "http://test.com/file.pdf",
      subject: "Math",
      weekName: "Week 1",
      gradeLevel: "Grade 10",
      teacherId: "user2", // mismatch
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Forbidden/);
  });

  it("should reject submissions with invalid schema", async () => {
    const result = await submitLessonPlan({
      fileUrl: "",
      subject: "",
      weekName: "",
      gradeLevel: "",
      teacherId: "",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Validation Error/);
  });

  it("should successfully submit lesson plan and increment version for revisions", async () => {
    const { getAuthenticatedUser } = require("../lib/auth-helpers");
    getAuthenticatedUser.mockResolvedValue({ uid: "user1", role: "TEACHER" });

    const result = await submitLessonPlan({
      fileUrl: "http://test.com/file_v2.pdf",
      filePath: "lesson-plans/user1/file_v2.pdf",
      subject: "Primary Science",
      weekName: "Week 2",
      gradeLevel: "Grade 4",
      teacherId: "user1",
      parentSubmissionId: "parent-doc-123",
      revisionNotes: "Added SMART verbs",
    });

    expect(result.success).toBe(true);
    expect(result.submissionId).toBe("mock-submission-id");
    expect(result.version).toBe(2);
  });
});
