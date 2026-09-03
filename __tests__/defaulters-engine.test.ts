import path from "path";
import { getDefaultersReportForWeek, isQuotaSubmitted } from "@/lib/defaulters";
import { parseFacultyFromFixture } from "@/scripts/seed-roster-from-fixture";

// Mock firebase-admin
const mockProfilesGet = jest.fn();
const mockSubmissionsGet = jest.fn();

jest.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: jest.fn((name: string) => {
      if (name === "profiles") {
        return {
          get: mockProfilesGet,
          where: jest.fn().mockReturnThis(),
        };
      }
      if (name === "submissions") {
        return {
          where: jest.fn().mockReturnValue({
            get: mockSubmissionsGet,
            where: jest.fn().mockReturnValue({
              get: mockSubmissionsGet,
            }),
          }),
          get: mockSubmissionsGet,
        };
      }
      return {
        get: jest.fn().mockResolvedValue({ docs: [] }),
        where: jest.fn().mockReturnThis(),
      };
    }),
  },
}));

describe("Defaulter Quotas & Joint Classes Engine Suite", () => {
  const fixturePath = path.join(
    __dirname,
    "../scripts/diagnostics/fixtures/local/rules-check.json"
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Classification: COMPLIANT, PARTIALLY_SUBMITTED, DEFAULTER", () => {
    it("should accurately classify faculty into Compliant, Partially Submitted, and Defaulter categories", async () => {
      // 3 Teaching Faculty:
      // 1. Compliant: Derrick Thompson (ICT) - 2 quotas, both submitted
      // 2. Partially Submitted: Abigail Sackey (Upper Primary) - 2 quotas, 1 submitted
      // 3. Defaulter: Samuel Gyasi (Mathematics) - 2 quotas, 0 submitted
      mockProfilesGet.mockResolvedValueOnce({
        docs: [
          {
            id: "t-derrick",
            data: () => ({
              full_name: "Mr. Derrick Thompson",
              email: "derrick.thompson@stadelaideschool.com",
              department: "ICT",
              expected_quotas: [
                { subject: "ICT", className: "Year 5 (Streams A & B)" },
                { subject: "ICT", className: "Year 6 (Streams A & B)" },
              ],
            }),
          },
          {
            id: "t-abigail",
            data: () => ({
              full_name: "Mrs. Abigail Sackey",
              email: "abigailsackey@stadelaideschool.com",
              department: "Upper Primary",
              expected_quotas: [
                { subject: "Mathematics", className: "Year 5 (Streams A & B)" },
                { subject: "Science", className: "Year 5 (Streams A & B)" },
              ],
            }),
          },
          {
            id: "t-samuel",
            data: () => ({
              full_name: "Mr. Samuel Gyasi",
              email: "samuel.gyasi@stadelaideschool.com",
              department: "Mathematics",
              expected_quotas: [
                { subject: "Mathematics", className: "Year 7 (Streams A & B)" },
                { subject: "Mathematics", className: "Year 8" },
              ],
            }),
          },
        ],
      });

      // Submissions:
      // Derrick submitted Year 5A ICT and Year 6B ICT (both quotas satisfied via double stream logic)
      // Abigail submitted Year 5A Mathematics only (Science missing)
      // Samuel submitted nothing
      mockSubmissionsGet.mockResolvedValueOnce({
        docs: [
          {
            data: () => ({
              teacher_id: "t-derrick",
              subject: "ICT",
              grade_level: "Year 5A",
              week_name: "Week 1",
            }),
          },
          {
            data: () => ({
              teacher_id: "t-derrick",
              subject: "ICT",
              grade_level: "Year 6B",
              week_name: "Week 1",
            }),
          },
          {
            data: () => ({
              teacher_id: "t-abigail",
              subject: "Mathematics",
              grade_level: "Year 5A",
              week_name: "Week 1",
            }),
          },
        ],
      });

      const report = await getDefaultersReportForWeek("Week 1");

      expect(report.totalTeachers).toBe(3);
      expect(report.submittedCount).toBe(1); // Only Derrick is 100% compliant
      expect(report.partiallySubmittedCount).toBe(1); // Abigail is partially submitted
      expect(report.defaulterCount).toBe(1); // Samuel is a defaulter

      // Check Partially Submitted details
      expect(report.partiallySubmitted).toHaveLength(1);
      const partial = report.partiallySubmitted![0];
      expect(partial.id).toBe("t-abigail");
      expect(partial.status).toBe("PARTIALLY_SUBMITTED");
      expect(partial.submittedQuotasCount).toBe(1);
      expect(partial.missingQuotas).toEqual([
        { subject: "Science", className: "Year 5 (Streams A & B)" },
      ]);

      // Check Defaulter details
      expect(report.defaulters).toHaveLength(1);
      const defaulter = report.defaulters[0];
      expect(defaulter.id).toBe("t-samuel");
      expect(defaulter.status).toBe("DEFAULTER");
      expect(defaulter.submittedQuotasCount).toBe(0);
      expect(defaulter.missingQuotas).toHaveLength(2);
    });
  });

  describe("PE Joint Classes Deduplication", () => {
    it("should collapse PE joint classes (Year 2 through Year 7) to 8 quotas instead of 14 separate entries", () => {
      const { activeFaculty } = parseFacultyFromFixture(fixturePath);
      const ruth = activeFaculty.find((t) => t.name.includes("Ruth Lartey"));

      expect(ruth).toBeDefined();
      expect(ruth?.assigned_subjects).toEqual(["PE"]);

      // Ruth teaches:
      // Year 1A (single stream)
      // Year 2A & 2B -> Year 2 (Joint)
      // Year 3A & 3B -> Year 3 (Joint)
      // Year 4A & 4B -> Year 4 (Joint)
      // Year 5A & 5B -> Year 5 (Joint)
      // Year 6A & 6B -> Year 6 (Joint)
      // Year 7A & 7B -> Year 7 (Joint)
      // Year 8 (single stream)
      // Total = 8 quotas, NOT 14
      expect(ruth?.expected_quotas).toHaveLength(8);

      const classNames = ruth?.expected_quotas.map((q) => q.className);
      expect(classNames).toEqual([
        "Year 1A",
        "Year 2 (Joint)",
        "Year 3 (Joint)",
        "Year 4 (Joint)",
        "Year 5 (Joint)",
        "Year 6 (Joint)",
        "Year 7 (Joint)",
        "Year 8",
      ]);
    });

    it("should satisfy joint PE quota with either stream A or stream B submission", () => {
      const peQuota = { subject: "PE", className: "Year 3 (Joint)" };

      // Submitting Year 3A PE satisfies the joint quota
      const subA = new Set(["pe:::year 3a"]);
      expect(isQuotaSubmitted(peQuota, subA)).toBe(true);

      // Submitting Year 3B PE satisfies the joint quota
      const subB = new Set(["pe:::year 3b"]);
      expect(isQuotaSubmitted(peQuota, subB)).toBe(true);

      // Submitting Year 3 PE satisfies the joint quota
      const subGeneric = new Set(["pe:::year 3"]);
      expect(isQuotaSubmitted(peQuota, subGeneric)).toBe(true);

      // Submitting Year 4 PE does NOT satisfy Year 3
      const subOther = new Set(["pe:::year 4a"]);
      expect(isQuotaSubmitted(peQuota, subOther)).toBe(false);
    });
  });

  describe("Zero-Quota Faculty & Non-Teaching Leadership Exclusion", () => {
    it("should exclude non-teaching leadership admins and nursery staff with zero quotas from reports", async () => {
      mockProfilesGet.mockResolvedValueOnce({
        docs: [
          // Non-teaching Leadership Admins
          {
            id: "admin-prince",
            data: () => ({
              full_name: "Prince Dunyoh",
              email: "princedunyoh@stadelaideschool.com",
              department: "Administration",
              role: "ADMIN",
              expected_quotas: [],
            }),
          },
          {
            id: "admin-theodora",
            data: () => ({
              full_name: "Theodora Hammond",
              email: "theodorahammond@stadelaideschool.com",
              department: "Administration",
              role: "ADMIN",
              expected_quotas: [],
            }),
          },
          // Nursery Teacher with 0 primary/secondary quotas
          {
            id: "nursery-teacher",
            data: () => ({
              full_name: "Nursery Teacher",
              email: "nursery@stadelaideschool.com",
              department: "Early Years",
              role: "TEACHER",
              expected_quotas: [],
            }),
          },
          // Active teaching faculty
          {
            id: "teacher-french",
            data: () => ({
              full_name: "M. Jean Dupont",
              email: "jeandupont@stadelaideschool.com",
              department: "French",
              role: "TEACHER",
              expected_quotas: [
                { subject: "French", className: "Year 1A" },
              ],
            }),
          },
        ],
      });

      mockSubmissionsGet.mockResolvedValueOnce({
        docs: [
          {
            data: () => ({
              teacher_id: "teacher-french",
              subject: "French",
              grade_level: "Year 1A",
              week_name: "Week 2",
            }),
          },
        ],
      });

      const report = await getDefaultersReportForWeek("Week 2");

      // Total teachers must ONLY count active teaching faculty (1), excluding leadership and nursery
      expect(report.totalTeachers).toBe(1);
      expect(report.submittedCount).toBe(1);
      expect(report.defaulterCount).toBe(0);

      // Verify Prince and Theodora are not in defaulters or partially submitted
      const allListedFaculty = [
        ...report.defaulters.map((d) => d.fullName),
        ...(report.partiallySubmitted?.map((d) => d.fullName) || []),
      ];
      expect(allListedFaculty).not.toContain("Prince Dunyoh");
      expect(allListedFaculty).not.toContain("Theodora Hammond");
      expect(allListedFaculty).not.toContain("Nursery Teacher");
    });
  });
});
