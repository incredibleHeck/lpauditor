import { updateSubmissionDecision } from "@/app/actions/submissions";
import { SCORE_PASSING_THRESHOLD } from "@/lib/constants";

jest.mock("@/lib/auth-helpers", () => ({
  getAuthenticatedUser: jest.fn(),
}));

const mockDocUpdate = jest.fn().mockResolvedValue(undefined);
const mockAuditGet = jest.fn();
const mockSubmissionGet = jest.fn();

jest.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: jest.fn().mockImplementation((name: string) => {
      if (name === "submissions") {
        return {
          doc: jest.fn().mockReturnValue({
            get: mockSubmissionGet,
            update: mockDocUpdate,
          }),
        };
      }
      if (name === "ai_audits") {
        return {
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              get: mockAuditGet,
            }),
          }),
        };
      }
      return {};
    }),
  },
}));

describe("Threshold Enforcement & HOD Approval Gate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should block approval if submission is flagged with requires_resubmission = true", async () => {
    const { getAuthenticatedUser } = require("@/lib/auth-helpers");
    getAuthenticatedUser.mockResolvedValue({
      uid: "hod-1",
      role: "HOD",
      department: "Mathematics",
      full_name: "Head of Math",
    });

    mockSubmissionGet.mockResolvedValue({
      exists: true,
      data: () => ({
        subject: "Mathematics",
        status: "RESUBMISSION_REQUIRED",
        requires_resubmission: true,
      }),
    });

    const result = await updateSubmissionDecision({
      submissionId: "sub-below-threshold",
      decision: "APPROVED",
      comments: "Trying to approve anyway",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Sign-off Blocked/);
    expect(mockDocUpdate).not.toHaveBeenCalled();
  });

  it("should block approval if audit score is strictly below 70%", async () => {
    const { getAuthenticatedUser } = require("@/lib/auth-helpers");
    getAuthenticatedUser.mockResolvedValue({
      uid: "hod-1",
      role: "HOD",
      department: "Primary Science",
      full_name: "Head of Science",
    });

    mockSubmissionGet.mockResolvedValue({
      exists: true,
      data: () => ({
        subject: "Primary Science",
        status: "COMPLETED",
        requires_resubmission: false,
      }),
    });

    mockAuditGet.mockResolvedValue({
      empty: false,
      docs: [
        {
          data: () => ({
            score: 65, // Below 70% threshold
          }),
        },
      ],
    });

    const result = await updateSubmissionDecision({
      submissionId: "sub-low-score",
      decision: "APPROVED",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain(`below the mandatory ${SCORE_PASSING_THRESHOLD}% threshold`);
    expect(mockDocUpdate).not.toHaveBeenCalled();
  });

  it("should permit approval if audit score is >= 70%", async () => {
    const { getAuthenticatedUser } = require("@/lib/auth-helpers");
    getAuthenticatedUser.mockResolvedValue({
      uid: "hod-1",
      role: "HOD",
      department: "Primary Science",
      full_name: "Head of Science",
    });

    mockSubmissionGet.mockResolvedValue({
      exists: true,
      data: () => ({
        subject: "Primary Science",
        status: "COMPLETED",
        requires_resubmission: false,
      }),
    });

    mockAuditGet.mockResolvedValue({
      empty: false,
      docs: [
        {
          data: () => ({
            score: 85, // Passing score
          }),
        },
      ],
    });

    const result = await updateSubmissionDecision({
      submissionId: "sub-high-score",
      decision: "APPROVED",
      comments: "Great lesson plan",
    });

    expect(result.success).toBe(true);
    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        hod_decision: "APPROVED",
        hod_feedback: "Great lesson plan",
      })
    );
  });

  it("should always allow REVISION_REQUESTED and NEEDS_OBSERVATION regardless of score", async () => {
    const { getAuthenticatedUser } = require("@/lib/auth-helpers");
    getAuthenticatedUser.mockResolvedValue({
      uid: "hod-1",
      role: "HOD",
      department: "Primary Science",
      full_name: "Head of Science",
    });

    mockSubmissionGet.mockResolvedValue({
      exists: true,
      data: () => ({
        subject: "Primary Science",
        status: "RESUBMISSION_REQUIRED",
        requires_resubmission: true,
      }),
    });

    const result = await updateSubmissionDecision({
      submissionId: "sub-low-score",
      decision: "REVISION_REQUESTED",
      comments: "Please add SMART objectives",
    });

    expect(result.success).toBe(true);
    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        hod_decision: "REVISION_REQUESTED",
        hod_feedback: "Please add SMART objectives",
      })
    );
  });
});
