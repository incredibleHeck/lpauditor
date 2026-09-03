import path from "path";
import { parseFacultyFromFixture, deriveEmailFromName } from "@/scripts/seed-roster-from-fixture";
import { getDefaultersReportForWeek, isQuotaSubmitted } from "@/lib/defaulters";
import { formatWhatsAppDefaultersMessage, DefaulterReportData } from "@/lib/whatsapp";

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

describe("Roster Seeding & Quota-Based Defaulter Engine", () => {
  const fixturePath = path.join(
    __dirname,
    "../scripts/diagnostics/fixtures/local/rules-check.json"
  );

  describe("parseFacultyFromFixture", () => {
    it("should parse 37 primary/secondary faculty and 2 leadership admins (nursery exempted)", () => {
      const { activeFaculty, zeroQuotaFaculty } = parseFacultyFromFixture(fixturePath);

      expect(activeFaculty).toHaveLength(37);
      expect(zeroQuotaFaculty).toHaveLength(2); // Leadership Admins: Prince Dunyoh & Theodora Hammond
      expect(zeroQuotaFaculty.some((f) => f.name === "Prince Dunyoh")).toBe(true);
      expect(zeroQuotaFaculty.some((f) => f.name === "Theodora Hammond")).toBe(true);
    });

    it("should collapse joint PE classes for Miss Ruth Lartey into 8 unique quotas", () => {
      const { activeFaculty } = parseFacultyFromFixture(fixturePath);
      const ruth = activeFaculty.find((t) => t.name.includes("Ruth Lartey"));

      expect(ruth).toBeDefined();
      expect(ruth?.assigned_subjects).toEqual(["PE"]);
      expect(ruth?.expected_quotas).toHaveLength(8);

      const classNames = ruth?.expected_quotas.map((q) => q.className);
      expect(classNames).toContain("Year 1A");
      expect(classNames).toContain("Year 2 (Joint)");
      expect(classNames).toContain("Year 3 (Joint)");
      expect(classNames).toContain("Year 4 (Joint)");
      expect(classNames).toContain("Year 5 (Joint)");
      expect(classNames).toContain("Year 6 (Joint)");
      expect(classNames).toContain("Year 7 (Joint)");
      expect(classNames).toContain("Year 8");
    });

    it("should correctly configure administrative and sectional HOD overrides and collapse double streams", () => {
      const { activeFaculty } = parseFacultyFromFixture(fixturePath);

      // Mr. Ayiku: ICT for Year 5A/B, 6A/B, 7A/B, 8 -> collapsed to 4 quotas
      const ayiku = activeFaculty.find((t) => t.name === "Mr. Ayiku");
      expect(ayiku).toBeDefined();
      expect(ayiku?.email).toBe("hectoraryiku@stadelaideschool.com");
      expect(ayiku?.role).toBe("ADMIN");
      expect(ayiku?.department).toBe("ICT");
      expect(ayiku?.expected_quotas).toHaveLength(4);
      expect(ayiku?.expected_quotas.map((q) => q.className)).toEqual([
        "Year 5 (Streams A & B)",
        "Year 6 (Streams A & B)",
        "Year 7 (Streams A & B)",
        "Year 8",
      ]);

      // Sectional HOD: Upper Primary (Mrs. Abigail Sackey) -> Year 5A & 5B Math collapsed to 1 quota
      const sackey = activeFaculty.find((t) => t.name === "Mrs. Abigail Sackey");
      expect(sackey).toBeDefined();
      expect(sackey?.email).toBe("abigailsackey@stadelaideschool.com");
      expect(sackey?.role).toBe("HOD");
      expect(sackey?.department).toBe("Upper Primary");
      expect(sackey?.expected_quotas).toHaveLength(1);
      expect(sackey?.expected_quotas[0].className).toBe("Year 5 (Streams A & B)");

      // Sectional HOD: Lower Primary (Mrs. Pauline Asante-Nti) -> Year 6A & 6B English collapsed to 1 quota
      const pauline = activeFaculty.find((t) => t.name === "Mrs. Pauline Asante-Nti");
      expect(pauline).toBeDefined();
      expect(pauline?.email).toBe("pauline.asante-nti@stadelaideschool.com");
      expect(pauline?.role).toBe("HOD");
      expect(pauline?.department).toBe("Lower Primary");
      expect(pauline?.expected_quotas).toHaveLength(1);
      expect(pauline?.expected_quotas[0].className).toBe("Year 6 (Streams A & B)");

      // Sectional HOD: Lower Secondary (Mrs. Joana Asiedua Amoh-Barimah) -> Year 7A/B + Year 8 English collapsed to 2 quotas
      const joana = activeFaculty.find((t) => t.name === "Mrs. Joana Asiedua Amoh-Barimah");
      expect(joana).toBeDefined();
      expect(joana?.email).toBe("joana.asiedua.amoh-barimah@stadelaideschool.com");
      expect(joana?.role).toBe("HOD");
      expect(joana?.department).toBe("Lower Secondary");
      expect(joana?.expected_quotas).toHaveLength(2);
      expect(joana?.expected_quotas.map((q) => q.className)).toEqual([
        "Year 7 (Streams A & B)",
        "Year 8",
      ]);

      // Split Stream Teachers: Mary Sekafa teaches only Year 2A (English, BK, Humanities)
      const sekafa = activeFaculty.find((t) => t.name === "Mary Sekafa");
      expect(sekafa).toBeDefined();
      expect(sekafa?.expected_quotas).toHaveLength(3);
      expect(sekafa?.expected_quotas.every((q) => q.className === "Year 2A")).toBe(true);

      // Split Stream Teachers: Francisca Fukour teaches only Year 2B (BK, Humanities)
      const fukour = activeFaculty.find((t) => t.name === "Francisca Fukour");
      expect(fukour).toBeDefined();
      expect(fukour?.expected_quotas).toHaveLength(2);
      expect(fukour?.expected_quotas.every((q) => q.className === "Year 2B")).toBe(true);
    });

    it("should correctly derive email addresses from teacher names", () => {
      expect(deriveEmailFromName("Mrs. Promise Ankrah")).toBe("promise.ankrah@stadelaideschool.com");
      expect(deriveEmailFromName("Mr. Derrick Thompson")).toBe("derrick.thompson@stadelaideschool.com");
      expect(deriveEmailFromName("Samuel")).toBe("samuel@stadelaideschool.com");
      expect(deriveEmailFromName("Mr. Ayiku")).toBe("hectoraryiku@stadelaideschool.com");
    });
  });

  describe("Quota-based getDefaultersReportForWeek", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should classify compliant, partially submitted, and full defaulters accurately", async () => {
      // 3 Teachers:
      // Teacher A: 2 quotas (Math 5A, Math 5B). Submitted both -> COMPLIANT
      // Teacher B: 2 quotas (ICT 6A, ICT 6B). Submitted 6A only -> PARTIALLY_SUBMITTED (Missing: 6B)
      // Teacher C: 1 quota (Science 4A). Submitted 0 -> DEFAULTER
      // Teacher D: Zero quotas (Nursery). Should be excluded entirely
      mockProfilesGet.mockResolvedValueOnce({
        docs: [
          {
            id: "teacher-a",
            data: () => ({
              full_name: "Teacher Alpha",
              email: "alpha@stadelaideschool.com",
              department: "Mathematics",
              expected_quotas: [
                { subject: "Mathematics", className: "Year 5A" },
                { subject: "Mathematics", className: "Year 5B" },
              ],
            }),
          },
          {
            id: "teacher-b",
            data: () => ({
              full_name: "Teacher Beta",
              email: "beta@stadelaideschool.com",
              department: "ICT",
              expected_quotas: [
                { subject: "ICT", className: "Year 6A" },
                { subject: "ICT", className: "Year 6B" },
              ],
            }),
          },
          {
            id: "teacher-c",
            data: () => ({
              full_name: "Teacher Gamma",
              email: "gamma@stadelaideschool.com",
              department: "Science",
              expected_quotas: [{ subject: "Science", className: "Year 4A" }],
            }),
          },
          {
            id: "teacher-nursery",
            data: () => ({
              full_name: "Nursery Teacher",
              email: "nursery@stadelaideschool.com",
              department: "Nursery",
              expected_quotas: [],
            }),
          },
        ],
      });

      // Submissions:
      // Teacher A submitted Math 5A and Math 5B
      // Teacher B submitted ICT 6A
      mockSubmissionsGet.mockResolvedValueOnce({
        docs: [
          {
            id: "sub-1",
            data: () => ({
              teacher_id: "teacher-a",
              subject: "Mathematics",
              grade_level: "Year 5A",
            }),
          },
          {
            id: "sub-2",
            data: () => ({
              teacher_id: "teacher-a",
              subject: "Mathematics",
              grade_level: "Year 5B",
            }),
          },
          {
            id: "sub-3",
            data: () => ({
              teacher_id: "teacher-b",
              subject: "ICT",
              grade_level: "Year 6A",
            }),
          },
        ],
      });

      const report = await getDefaultersReportForWeek("Week 3");

      expect(report.totalTeachers).toBe(3); // Nursery teacher excluded!
      expect(report.submittedCount).toBe(1); // Teacher A only
      expect(report.partiallySubmittedCount).toBe(1); // Teacher B
      expect(report.defaulterCount).toBe(1); // Teacher C

      // Check Teacher B partial details
      expect(report.partiallySubmitted).toHaveLength(1);
      expect(report.partiallySubmitted![0].fullName).toBe("Teacher Beta");
      expect(report.partiallySubmitted![0].missingQuotas).toEqual([
        { subject: "ICT", className: "Year 6B" },
      ]);

      // Check Teacher C full defaulter details
      expect(report.defaulters).toHaveLength(1);
      expect(report.defaulters[0].fullName).toBe("Teacher Gamma");
    });
  });

  describe("formatWhatsAppDefaultersMessage", () => {
    it("should itemize partially submitted teachers with their missing classes", () => {
      const sampleReport: DefaulterReportData = {
        weekName: "Week 4",
        deadlineDate: "Friday, Sep 25, 2026 at 17:00",
        totalTeachers: 10,
        submittedCount: 8,
        partiallySubmittedCount: 1,
        defaulterCount: 1,
        partiallySubmitted: [
          {
            id: "t-1",
            fullName: "Mr. Derrick Thompson",
            email: "derrick.thompson@stadelaideschool.com",
            department: "ICT",
            status: "PARTIALLY_SUBMITTED",
            missingQuotas: [
              { subject: "ICT", className: "Year 2A" },
              { subject: "ICT", className: "Year 3B" },
            ],
          },
        ],
        defaulters: [
          {
            id: "t-2",
            fullName: "Mrs. Serwaa Sampson",
            email: "serwaa.sampson@stadelaideschool.com",
            department: "Mathematics",
            status: "DEFAULTER",
            totalQuotas: 2,
          },
        ],
      };

      const msg = formatWhatsAppDefaultersMessage(sampleReport);

      expect(msg).toContain("Partially Submitted Faculty (1):");
      expect(msg).toContain("Mr. Derrick Thompson");
      expect(msg).toContain("Year 2A ICT, Year 3B ICT");
      expect(msg).toContain("Outstanding Defaulters");
      expect(msg).toContain("Mrs. Serwaa Sampson");
    });

    it("should truncate gracefully if message exceeds character bounds", () => {
      const longList = Array.from({ length: 60 }, (_, i) => ({
        id: `t-${i}`,
        fullName: `Teacher Number ${i} Long Name Testing`,
        email: `teacher${i}.longname@stadelaideschool.com`,
        department: `Department of Academic Subject ${i}`,
        status: "DEFAULTER" as const,
      }));

      const bigReport: DefaulterReportData = {
        weekName: "Week 1",
        deadlineDate: "Friday, Sep 4, 2026",
        totalTeachers: 60,
        submittedCount: 0,
        defaulterCount: 60,
        defaulters: longList,
      };

      const msg = formatWhatsAppDefaultersMessage(bigReport);

      expect(msg.length).toBeLessThanOrEqual(4096);
      expect(msg).toContain("Report truncated due to WhatsApp character limits");
    });
  });

  describe("isQuotaSubmitted (Double Stream & Split Stream Compliance)", () => {
    it("should satisfy a double stream quota (Year 5 Streams A & B) with a single submission for Year 5A", () => {
      const quota = { subject: "Mathematics", className: "Year 5 (Streams A & B)" };
      const submissions = new Set(["mathematics:::year 5a"]);

      expect(isQuotaSubmitted(quota, submissions)).toBe(true);
    });

    it("should satisfy a double stream quota with a single submission for Year 5B or Year 5", () => {
      const quota = { subject: "Mathematics", className: "Year 5 (Streams A & B)" };

      expect(isQuotaSubmitted(quota, new Set(["mathematics:::year 5b"]))).toBe(true);
      expect(isQuotaSubmitted(quota, new Set(["mathematics:::year 5"]))).toBe(true);
    });

    it("should NOT satisfy a double stream quota if submission is for a different subject or year", () => {
      const quota = { subject: "Mathematics", className: "Year 5 (Streams A & B)" };

      expect(isQuotaSubmitted(quota, new Set(["science:::year 5a"]))).toBe(false);
      expect(isQuotaSubmitted(quota, new Set(["mathematics:::year 6a"]))).toBe(false);
    });

    it("should enforce exact stream compliance for split-stream teachers", () => {
      // Teacher A teaches Year 2A Science
      const quota2A = { subject: "Science", className: "Year 2A" };
      // Teacher B teaches Year 2B Science
      const quota2B = { subject: "Science", className: "Year 2B" };

      // Teacher A submits Year 2A
      expect(isQuotaSubmitted(quota2A, new Set(["science:::year 2a"]))).toBe(true);
      // Year 2A submission does NOT satisfy Teacher B's Year 2B quota
      expect(isQuotaSubmitted(quota2B, new Set(["science:::year 2a"]))).toBe(false);

      // Teacher B submits Year 2B
      expect(isQuotaSubmitted(quota2B, new Set(["science:::year 2b"]))).toBe(true);
      // Year 2B submission does NOT satisfy Teacher A's Year 2A quota
      expect(isQuotaSubmitted(quota2A, new Set(["science:::year 2b"]))).toBe(false);
    });
  });
});
