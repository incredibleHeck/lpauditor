import { isInstitutionalEmail, isAdminEmail, SCHOOL_EMAIL_DOMAIN } from "@/lib/constants";
import { getAuthenticatedUser } from "@/lib/auth-helpers";

// Mock cookies and firebase-admin
const mockCookies = jest.fn();
jest.mock("next/headers", () => ({
  cookies: () => mockCookies(),
}));

const mockVerifySessionCookie = jest.fn();
const mockVerifyIdToken = jest.fn();
const mockProfilesDocGet = jest.fn();
const mockProfilesDocUpdate = jest.fn();

jest.mock("@/lib/firebase-admin", () => ({
  adminAuth: {
    verifySessionCookie: (...args: any[]) => mockVerifySessionCookie(...args),
    verifyIdToken: (...args: any[]) => mockVerifyIdToken(...args),
  },
  adminDb: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: mockProfilesDocGet,
        update: mockProfilesDocUpdate,
      })),
    })),
  },
}));

describe("Security, Auth & CSV Hardening Suite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Self-Registration & Role Privilege Separation", () => {
    it("should strictly prevent self-registration from elevating role to ADMIN", async () => {
      // Setup session cookie for a non-whitelisted user attempting privilege escalation
      mockCookies.mockReturnValue({
        get: jest.fn().mockReturnValue({ value: "valid-session-cookie" }),
      });

      mockVerifySessionCookie.mockResolvedValueOnce({
        uid: "attacker-user-id",
        email: "malicious.teacher@stadelaideschool.com",
      });

      // Even if Firestore doc contains role: "ADMIN" for non-whitelisted user, getAuthenticatedUser enforces TEACHER
      mockProfilesDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          full_name: "Sneaky User",
          email: "malicious.teacher@stadelaideschool.com",
          role: "ADMIN", // Attacker injected role in profile
          department: "Mathematics",
        }),
      });

      const user = await getAuthenticatedUser();

      // Verified: non-whitelisted user cannot receive ADMIN role
      expect(user.role).not.toBe("ADMIN");
      expect(user.role).toBe("TEACHER");
    });

    it("should allow ADMIN role only for cryptographically authorized institutional admins", async () => {
      mockCookies.mockReturnValue({
        get: jest.fn().mockReturnValue({ value: "admin-session-cookie" }),
      });

      mockVerifySessionCookie.mockResolvedValueOnce({
        uid: "official-admin-uid",
        email: "princedunyoh@stadelaideschool.com",
      });

      mockProfilesDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          full_name: "Prince Dunyoh",
          email: "princedunyoh@stadelaideschool.com",
          role: "ADMIN",
          department: "Administration",
        }),
      });

      const user = await getAuthenticatedUser();
      expect(user.role).toBe("ADMIN");
      expect(isAdminEmail(user.email)).toBe(true);
    });
  });

  describe("Institutional Email & Domain Verification Requirements", () => {
    it("should strictly reject non-institutional personal emails (e.g. Gmail, Yahoo, Outlook)", async () => {
      expect(isInstitutionalEmail("teacher@gmail.com")).toBe(false);
      expect(isInstitutionalEmail("headmaster@yahoo.com")).toBe(false);
      expect(isInstitutionalEmail("admin@outlook.com")).toBe(false);
      expect(isInstitutionalEmail("test@unknownschool.org")).toBe(false);
      expect(isInstitutionalEmail("")).toBe(false);
      expect(isInstitutionalEmail(null)).toBe(false);
      expect(isInstitutionalEmail(undefined)).toBe(false);

      // Verify that getAuthenticatedUser throws Forbidden error for non-institutional email
      mockCookies.mockReturnValue({
        get: jest.fn().mockReturnValue({ value: "public-session-cookie" }),
      });

      mockVerifySessionCookie.mockResolvedValueOnce({
        uid: "public-uid",
        email: "random.person@gmail.com",
      });

      await expect(getAuthenticatedUser()).rejects.toThrow(
        new RegExp(`Access is restricted exclusively to St. Adelaide International School accounts.*${SCHOOL_EMAIL_DOMAIN}`)
      );
    });

    it("should accept valid institutional email addresses under @stadelaideschool.com", () => {
      expect(isInstitutionalEmail("derrick.thompson@stadelaideschool.com")).toBe(true);
      expect(isInstitutionalEmail("abigailsackey@stadelaideschool.com")).toBe(true);
      expect(isInstitutionalEmail("PRINCE.DUNYOH@STADELAIDESCHOOL.COM")).toBe(true);
    });
  });

  describe("CSV Formula Injection Neutralization (CWE-1236)", () => {
    // Formula sanitizer mirroring HODDashboard.tsx exportToCSV logic
    const sanitizeCSVField = (val: unknown): string => {
      if (val === null || val === undefined) return '""';
      let clean = String(val).replace(/[\r\n]+/g, " ").trim();
      // If cell begins with =, +, -, @, \t, \r, |, or %, prepend a single quote to disarm formula execution
      if (/^[=+\-@\t\r|%]/.test(clean)) {
        clean = `'${clean}`;
      }
      return `"${clean.replace(/"/g, '""')}"`;
    };

    it("should neutralize formulas starting with '=' (e.g. =cmd|' /C calc'!A0)", () => {
      const malicious = "=cmd|' /C calc'!A0";
      const sanitized = sanitizeCSVField(malicious);
      expect(sanitized).toBe("\"'=cmd|' /C calc'!A0\"");
      expect(sanitized.startsWith("\"'=")).toBe(true);
    });

    it("should neutralize formulas starting with '+', '-', and '@'", () => {
      expect(sanitizeCSVField("+12345+SUM(1,2)")).toBe("\"'+12345+SUM(1,2)\"");
      expect(sanitizeCSVField("-5+2")).toBe("\"'-5+2\"");
      expect(sanitizeCSVField("@SUM(A1:A10)")).toBe("\"'@SUM(A1:A10)\"");
    });

    it("should neutralize formulas starting with control characters (tabs, newlines, pipes, percents)", () => {
      expect(sanitizeCSVField("\t=HYPERLINK()")).toBe("\"'=HYPERLINK()\"");
      expect(sanitizeCSVField("|dangerous_pipe")).toBe("\"'|dangerous_pipe\"");
      expect(sanitizeCSVField("%100_percent")).toBe("\"'%100_percent\"");
    });

    it("should preserve standard alphanumeric text without prepending single quotes", () => {
      expect(sanitizeCSVField("Mr. Derrick Thompson")).toBe('"Mr. Derrick Thompson"');
      expect(sanitizeCSVField("Cambridge Primary Science")).toBe('"Cambridge Primary Science"');
      expect(sanitizeCSVField("Year 5A")).toBe('"Year 5A"');
    });

    it("should properly escape internal double quotes", () => {
      expect(sanitizeCSVField('Unit 1: "The Solar System"')).toBe('"Unit 1: ""The Solar System"""');
    });
  });
});
