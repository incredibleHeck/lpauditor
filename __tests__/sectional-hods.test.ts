import { updateSubmissionDecision, getDepartmentSubmissions } from "@/app/actions/submissions";
import { getDepartmentAnalytics } from "@/app/actions/ai";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { adminDb } from "@/lib/firebase-admin";

jest.mock("@/lib/auth-helpers");
jest.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: jest.fn(),
  },
  adminAuth: {
    getUserByEmail: jest.fn(),
    createUser: jest.fn(),
    generatePasswordResetLink: jest.fn(),
    setCustomUserClaims: jest.fn(),
  },
}));

describe("Sectional HOD Oversight (St. Adelaide Dansoman Campus)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Lower Primary HOD (Mrs. Pauline Asante-Nti)", () => {
    it("should allow Lower Primary HOD to approve a Year 2A Science lesson plan", async () => {
      (getAuthenticatedUser as jest.Mock).mockResolvedValue({
        id: "hod-pauline",
        role: "HOD",
        department: "Lower Primary",
        email: "pauline.asante-nti@stadelaideschool.com",
      });

      const mockSubDoc = {
        exists: true,
        data: () => ({
          subject: "Science",
          grade_level: "Year 2A",
          status: "COMPLETED",
          requires_resubmission: false,
        }),
      };

      const mockAuditSnapshot = {
        empty: false,
        docs: [{ data: () => ({ score: 85 }) }],
      };

      (adminDb.collection as jest.Mock).mockImplementation((colName: string) => {
        if (colName === "submissions") {
          return {
            doc: jest.fn(() => ({
              get: jest.fn().mockResolvedValue(mockSubDoc),
              update: jest.fn().mockResolvedValue(undefined),
            })),
          };
        }
        if (colName === "ai_audits") {
          return {
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue(mockAuditSnapshot),
          };
        }
        return {};
      });

      const result = await updateSubmissionDecision({
        submissionId: "sub-yr2-science",
        decision: "APPROVED",
        comments: "Excellent hands-on inquiry activities for Year 2.",
      });

      expect(result.success).toBe(true);
    });

    it("should BLOCK Lower Primary HOD from approving a Year 5A Mathematics plan (Cross-Division)", async () => {
      (getAuthenticatedUser as jest.Mock).mockResolvedValue({
        id: "hod-pauline",
        role: "HOD",
        department: "Lower Primary",
        email: "pauline.asante-nti@stadelaideschool.com",
      });

      const mockSubDoc = {
        exists: true,
        data: () => ({
          subject: "Mathematics",
          grade_level: "Year 5A", // Belongs to Upper Primary
          status: "COMPLETED",
          requires_resubmission: false,
        }),
      };

      (adminDb.collection as jest.Mock).mockReturnValue({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue(mockSubDoc),
        })),
      });

      const result = await updateSubmissionDecision({
        submissionId: "sub-yr5-math",
        decision: "APPROVED",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Forbidden: Only assigned HODs can update submission decisions.");
    });
  });

  describe("Upper Primary HOD (Mrs. Abigail Sackey)", () => {
    it("should allow Upper Primary HOD to approve a Year 6B ICT plan", async () => {
      (getAuthenticatedUser as jest.Mock).mockResolvedValue({
        id: "hod-abigail",
        role: "HOD",
        department: "Upper Primary",
        email: "abigailsackey@stadelaideschool.com",
      });

      const mockSubDoc = {
        exists: true,
        data: () => ({
          subject: "ICT",
          grade_level: "Year 6B",
          status: "COMPLETED",
          requires_resubmission: false,
        }),
      };

      const mockAuditSnapshot = {
        empty: false,
        docs: [{ data: () => ({ score: 92 }) }],
      };

      (adminDb.collection as jest.Mock).mockImplementation((colName: string) => {
        if (colName === "submissions") {
          return {
            doc: jest.fn(() => ({
              get: jest.fn().mockResolvedValue(mockSubDoc),
              update: jest.fn().mockResolvedValue(undefined),
            })),
          };
        }
        if (colName === "ai_audits") {
          return {
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue(mockAuditSnapshot),
          };
        }
        return {};
      });

      const result = await updateSubmissionDecision({
        submissionId: "sub-yr6-ict",
        decision: "APPROVED",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Lower Secondary HOD (Mrs. Joana Amoh-Barimah)", () => {
    it("should allow Lower Secondary HOD to approve a Year 8 English plan", async () => {
      (getAuthenticatedUser as jest.Mock).mockResolvedValue({
        id: "hod-joana",
        role: "HOD",
        department: "Lower Secondary",
        email: "joana.asiedua.amoh-barimah@stadelaideschool.com",
      });

      const mockSubDoc = {
        exists: true,
        data: () => ({
          subject: "English",
          grade_level: "Year 8",
          status: "COMPLETED",
          requires_resubmission: false,
        }),
      };

      const mockAuditSnapshot = {
        empty: false,
        docs: [{ data: () => ({ score: 88 }) }],
      };

      (adminDb.collection as jest.Mock).mockImplementation((colName: string) => {
        if (colName === "submissions") {
          return {
            doc: jest.fn(() => ({
              get: jest.fn().mockResolvedValue(mockSubDoc),
              update: jest.fn().mockResolvedValue(undefined),
            })),
          };
        }
        if (colName === "ai_audits") {
          return {
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue(mockAuditSnapshot),
          };
        }
        return {};
      });

      const result = await updateSubmissionDecision({
        submissionId: "sub-yr8-english",
        decision: "APPROVED",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Administrator Oversight (Mr. Ayiku)", () => {
    it("should allow Administrator to approve any class in any division", async () => {
      (getAuthenticatedUser as jest.Mock).mockResolvedValue({
        id: "admin-ayiku",
        role: "ADMIN",
        department: "ICT",
        email: "hectoraryiku@stadelaideschool.com",
      });

      const mockSubDoc = {
        exists: true,
        data: () => ({
          subject: "French",
          grade_level: "Year 1A",
          status: "COMPLETED",
          requires_resubmission: false,
        }),
      };

      const mockAuditSnapshot = {
        empty: false,
        docs: [{ data: () => ({ score: 78 }) }],
      };

      (adminDb.collection as jest.Mock).mockImplementation((colName: string) => {
        if (colName === "submissions") {
          return {
            doc: jest.fn(() => ({
              get: jest.fn().mockResolvedValue(mockSubDoc),
              update: jest.fn().mockResolvedValue(undefined),
            })),
          };
        }
        if (colName === "ai_audits") {
          return {
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue(mockAuditSnapshot),
          };
        }
        return {};
      });

      const result = await updateSubmissionDecision({
        submissionId: "sub-yr1-french",
        decision: "APPROVED",
      });

      expect(result.success).toBe(true);
    });
  });
});
