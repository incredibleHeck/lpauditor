import { getCurrentWeekLabel, getDeadlineStringForWeek, getDefaultersReportForWeek } from "@/lib/defaulters";

jest.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: jest.fn(),
  },
}));

describe("Defaulters Engine", () => {
  it("should return a valid week label string", () => {
    const weekLabel = getCurrentWeekLabel();
    expect(weekLabel).toMatch(/^Week \d+$/);
  });

  it("should return a formatted Friday deadline string", () => {
    const deadline = getDeadlineStringForWeek();
    expect(deadline).toContain("Friday");
    expect(deadline).toMatch(/\d{4}/);
  });

  it("should identify teachers without submissions as defaulters and exclude non-teaching admins", async () => {
    const { adminDb } = require("@/lib/firebase-admin");

    const mockProfiles = [
      {
        id: "teacher-1",
        data: () => ({
          full_name: "John Doe",
          email: "johndoe@stadelaideschool.com",
          department: "Mathematics",
        }),
      },
      {
        id: "teacher-2",
        data: () => ({
          full_name: "Jane Smith",
          email: "janesmith@stadelaideschool.com",
          department: "Primary Science",
        }),
      },
      {
        id: "admin-principal",
        data: () => ({
          full_name: "Theodora Hammond",
          email: "theodorahammond@stadelaideschool.com", // Non-teaching admin
          department: "Administration",
        }),
      },
    ];

    const mockSubmissions = [
      {
        id: "sub-1",
        data: () => ({
          teacher_id: "teacher-1", // Teacher 1 submitted
          subject: "Mathematics",
          week_name: "Week 1",
        }),
      },
    ];

    adminDb.collection.mockImplementation((name: string) => {
      if (name === "profiles") {
        return {
          get: jest.fn().mockResolvedValue({ docs: mockProfiles }),
          where: jest.fn().mockReturnThis(),
        };
      }
      if (name === "submissions") {
        return {
          where: jest.fn().mockReturnThis(),
          get: jest.fn().mockResolvedValue({ docs: mockSubmissions }),
        };
      }
      return { get: jest.fn().mockResolvedValue({ docs: [] }) };
    });

    const report = await getDefaultersReportForWeek("Week 1");

    // Total non-admin teachers = 2 (teacher-1, teacher-2)
    expect(report.totalTeachers).toBe(2);
    // Submitted count = 1 (teacher-1)
    expect(report.submittedCount).toBe(1);
    // Defaulter count = 1 (teacher-2)
    expect(report.defaulterCount).toBe(1);
    expect(report.defaulters[0].id).toBe("teacher-2");
    expect(report.defaulters[0].fullName).toBe("Jane Smith");
  });
});
