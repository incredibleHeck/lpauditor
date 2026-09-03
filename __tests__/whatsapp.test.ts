import {
  normalizeWhatsAppPhoneNumber,
  formatDefaultersWhatsAppMessage,
  generateWhatsAppNudgeUrl,
  sendWhatsAppMessage,
  DefaulterReportData,
} from "@/lib/whatsapp";

describe("WhatsApp Notification Utility", () => {
  describe("normalizeWhatsAppPhoneNumber", () => {
    it("should convert Ghanaian local numbers (024...) to international format (23324...)", () => {
      expect(normalizeWhatsAppPhoneNumber("0241234567")).toBe("233241234567");
      expect(normalizeWhatsAppPhoneNumber("024 123 4567")).toBe("233241234567");
      expect(normalizeWhatsAppPhoneNumber("050-987-6543")).toBe("233509876543");
    });

    it("should preserve numbers already in 233 format", () => {
      expect(normalizeWhatsAppPhoneNumber("+233 24 123 4567")).toBe("233241234567");
      expect(normalizeWhatsAppPhoneNumber("233241234567")).toBe("233241234567");
    });

    it("should handle empty or null values gracefully", () => {
      expect(normalizeWhatsAppPhoneNumber("")).toBe("");
      expect(normalizeWhatsAppPhoneNumber(null)).toBe("");
      expect(normalizeWhatsAppPhoneNumber(undefined)).toBe("");
    });
  });

  describe("formatDefaultersWhatsAppMessage", () => {
    it("should format a full defaulter report using WhatsApp markdown (*bold*)", () => {
      const report: DefaulterReportData = {
        weekName: "Week 3",
        deadlineDate: "Friday, Sep 4, 2026 at 17:00",
        totalTeachers: 10,
        submittedCount: 7,
        partiallySubmittedCount: 1,
        defaulterCount: 2,
        partiallySubmitted: [
          {
            id: "t-1",
            fullName: "Mrs. Erica Frempong Eyiah",
            email: "erica@stadelaideschool.com",
            department: "Primary",
            missingQuotas: [{ subject: "Science", className: "Year 2B" }],
          },
        ],
        defaulters: [
          {
            id: "t-2",
            fullName: "Augustina Baah",
            email: "augustina@stadelaideschool.com",
            department: "Primary",
            totalQuotas: 2,
          },
          {
            id: "t-3",
            fullName: "Mr. Derrick Thompson",
            email: "derrick@stadelaideschool.com",
            department: "Mathematics",
            totalQuotas: 4,
          },
        ],
      };

      const message = formatDefaultersWhatsAppMessage(report);

      expect(message).toContain("*St. Adelaide International School*");
      expect(message).toContain("*Weekly Lesson Plan Compliance Report — Week 3*");
      expect(message).toContain("• Fully Compliant (All Quotas): *7* (70%)");
      expect(message).toContain("Partially Submitted Faculty (1):");
      expect(message).toContain("Mrs. Erica Frempong Eyiah");
      expect(message).toContain("Year 2B Science");
      expect(message).toContain("Outstanding Defaulters — Zero Plans Submitted (2):");
      expect(message).toContain("Augustina Baah");
      expect(message).toContain("Mr. Derrick Thompson");
    });

    it("should format a 100% compliance celebration message when there are zero defaulters", () => {
      const report: DefaulterReportData = {
        weekName: "Week 4",
        deadlineDate: "Friday, Sep 11, 2026 at 17:00",
        totalTeachers: 37,
        submittedCount: 37,
        partiallySubmittedCount: 0,
        defaulterCount: 0,
        defaulters: [],
        partiallySubmitted: [],
      };

      const message = formatDefaultersWhatsAppMessage(report);

      expect(message).toContain("100%");
      expect(message).toContain("All faculty members have submitted their lesson plans for all assigned classes!");
    });
  });

  describe("generateWhatsAppNudgeUrl", () => {
    it("should generate a valid wa.me link with encoded polite reminder", () => {
      const url = generateWhatsAppNudgeUrl(
        "024 123 4567",
        "Mrs. Promise Ankrah",
        [{ subject: "English", className: "Year 3" }],
        "Week 2"
      );

      expect(url).toContain("https://wa.me/233241234567?text=");
      const decodedText = decodeURIComponent(url.replace("https://wa.me/233241234567?text=", ""));
      expect(decodedText).toContain("Hello Mrs. Promise Ankrah");
      expect(decodedText).toContain("Year 3 English");
      expect(decodedText).toContain("Week 2");
      expect(decodedText).toContain("https://lpauditor.stadelaideschool.com");
    });

    it("should return empty string if phone number is invalid or empty", () => {
      const url = generateWhatsAppNudgeUrl("", "Teacher");
      expect(url).toBe("");
    });
  });

  describe("sendWhatsAppMessage", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
      delete process.env.WHATSAPP_API_TOKEN;
      delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      delete process.env.WHATSAPP_RECIPIENT_PHONE;
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it("should gracefully run in simulated mode when Meta API credentials are not set", async () => {
      const result = await sendWhatsAppMessage("Test alert message");

      expect(result.success).toBe(true);
      expect(result.simulated).toBe(true);
      expect(result.messageId).toContain("sim-wa-");
    });

    it("should send via Meta Cloud API when credentials are provided", async () => {
      process.env.WHATSAPP_API_TOKEN = "mock-token";
      process.env.WHATSAPP_PHONE_NUMBER_ID = "mock-phone-id";
      process.env.WHATSAPP_RECIPIENT_PHONE = "0241234567";

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ messages: [{ id: "wamid.HBgL..." }] }),
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      const result = await sendWhatsAppMessage("Hello Admin");

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("wamid.HBgL...");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://graph.facebook.com/v21.0/mock-phone-id/messages",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer mock-token",
          }),
        })
      );
    });
  });
});
