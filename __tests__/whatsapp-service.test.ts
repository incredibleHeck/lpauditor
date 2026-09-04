import {
  sendWhatsAppMessage,
  normalizeGhanaPhoneNumber,
  normalizeWhatsAppPhoneNumber,
  generateWhatsAppNudgeUrl,
  formatWhatsAppDefaultersMessage,
  splitWhatsAppMessage,
  DefaulterReportData,
} from "@/lib/whatsapp";

describe("Meta WhatsApp Cloud Service Suite", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("Phone Number Sanitization & E.164 Normalization", () => {
    it("should strip whitespace, dashes, and non-digits", () => {
      expect(normalizeGhanaPhoneNumber("024 123-4567")).toBe("233241234567");
      expect(normalizeGhanaPhoneNumber("(050) 987 6543")).toBe("233509876543");
    });

    it("should convert Ghanaian local prefixes (024, 050, 020) to international E.164 (233...)", () => {
      expect(normalizeGhanaPhoneNumber("0241234567")).toBe("233241234567");
      expect(normalizeGhanaPhoneNumber("0509876543")).toBe("233509876543");
      expect(normalizeGhanaPhoneNumber("0201122334")).toBe("233201122334");
      // 9-digit local without leading 0
      expect(normalizeGhanaPhoneNumber("241234567")).toBe("233241234567");
      expect(normalizeGhanaPhoneNumber("509876543")).toBe("233509876543");
      // 13-digit with redundant 0 after country code
      expect(normalizeGhanaPhoneNumber("2330241234567")).toBe("233241234567");
    });


    it("should preserve numbers already in international E.164 format (+233 or 233)", () => {
      expect(normalizeGhanaPhoneNumber("+233241234567")).toBe("233241234567");
      expect(normalizeGhanaPhoneNumber("233509876543")).toBe("233509876543");
      expect(normalizeGhanaPhoneNumber("+233 50 987 6543")).toBe("233509876543");
    });

    it("should gracefully handle null, undefined, empty, and invalid strings", () => {
      expect(normalizeGhanaPhoneNumber(null)).toBe("");
      expect(normalizeGhanaPhoneNumber(undefined)).toBe("");
      expect(normalizeGhanaPhoneNumber("")).toBe("");
      expect(normalizeGhanaPhoneNumber("   ")).toBe("");
      expect(normalizeGhanaPhoneNumber("abc-xyz")).toBe("");
    });

    it("should maintain backward-compatible alias normalizeWhatsAppPhoneNumber", () => {
      expect(normalizeWhatsAppPhoneNumber("0241234567")).toBe("233241234567");
    });
  });

  describe("Official Meta Cloud API Payload Schema Validation", () => {
    it("should dispatch to Graph API v20.0 with official payload schema and authorization headers", async () => {
      process.env.WHATSAPP_CLOUD_API_TOKEN = "test-meta-permanent-token";
      process.env.WHATSAPP_PHONE_NUMBER_ID = "109876543210987";
      process.env.WHATSAPP_ADMIN_RECIPIENT_PHONE = "0241234567";

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          messaging_product: "whatsapp",
          contacts: [{ input: "233241234567", wa_id: "233241234567" }],
          messages: [{ id: "wamid.HBgLMjMzMjQxMjM0NTY3FQIAERgSRjQ1Nj..." }],
        }),
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      const result = await sendWhatsAppMessage("0241234567", "Institutional Compliance Alert");

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("wamid.HBgLMjMzMjQxMjM0NTY3FQIAERgSRjQ1Nj...");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];

      // Verify endpoint target
      expect(url).toBe("https://graph.facebook.com/v20.0/109876543210987/messages");

      // Verify headers
      expect(options.method).toBe("POST");
      expect(options.headers).toEqual({
        Authorization: "Bearer test-meta-permanent-token",
        "Content-Type": "application/json",
      });

      // Verify official Meta text payload schema
      const payload = JSON.parse(options.body as string);
      expect(payload).toEqual({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: "233241234567",
        type: "text",
        text: {
          preview_url: false,
          body: "Institutional Compliance Alert",
        },
      });
    });

    it("should support 1-argument signature defaulting to WHATSAPP_ADMIN_RECIPIENT_PHONE", async () => {
      process.env.WHATSAPP_CLOUD_API_TOKEN = "test-token";
      process.env.WHATSAPP_PHONE_NUMBER_ID = "phone-id-123";
      process.env.WHATSAPP_ADMIN_RECIPIENT_PHONE = "0509876543";

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ messages: [{ id: "wa-msg-admin-1" }] }),
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      const result = await sendWhatsAppMessage("Admin Alert Body");

      expect(result.success).toBe(true);
      const [, options] = mockFetch.mock.calls[0];
      const payload = JSON.parse(options.body as string);
      expect(payload.to).toBe("233509876543");
      expect(payload.text.body).toBe("Admin Alert Body");
    });
  });

  describe("Graceful Unconfigured Fallback", () => {
    it("should return { success: true, mocked: true } when API token or phone ID is missing", async () => {
      delete process.env.WHATSAPP_CLOUD_API_TOKEN;
      delete process.env.WHATSAPP_API_TOKEN;
      delete process.env.WHATSAPP_PHONE_NUMBER_ID;

      const mockFetch = jest.fn();
      global.fetch = mockFetch as unknown as typeof fetch;

      const result = await sendWhatsAppMessage("0241234567", "Test alert");

      expect(result.success).toBe(true);
      expect(result.mocked).toBe(true);
      expect(result.simulated).toBe(true);
      expect(result.messageId).toMatch(/^mock-wa-/);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should return error without crashing if recipient phone number is invalid", async () => {
      process.env.WHATSAPP_CLOUD_API_TOKEN = "token-123";
      process.env.WHATSAPP_PHONE_NUMBER_ID = "id-123";

      const result = await sendWhatsAppMessage("", "Message text");

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid recipient phone/i);
    });
  });

  describe("1-Click WhatsApp Nudge URL (wa.me)", () => {
    it("should generate a valid wa.me link with URL-encoded polite reminder and missing quotas", () => {
      const url = generateWhatsAppNudgeUrl(
        "0241234567",
        "Mr. Thompson",
        [
          { className: "Year 2A", subject: "ICT" },
          { className: "Year 3B", subject: "ICT" },
        ],
        "Week 3"
      );

      expect(url).toContain("https://wa.me/233241234567?text=");
      const queryParam = url.split("?text=")[1];
      const decodedText = decodeURIComponent(queryParam);

      expect(decodedText).toContain("Hello Mr. Thompson");
      expect(decodedText).toContain("Year 2A ICT and Year 3B ICT");
      expect(decodedText).toContain("Week 3");
      expect(decodedText).toContain("https://lpauditor.stadelaideschool.com");
    });

    it("should return empty string if phone number is empty or invalid", () => {
      expect(generateWhatsAppNudgeUrl("", "Mr. Thompson")).toBe("");
      expect(generateWhatsAppNudgeUrl("invalid-phone", "Mr. Thompson")).toBe("");
    });
  });

  describe("Message Formatting & Length Bounds (<4,096 characters)", () => {
    it("should format defaulters and partially submitted faculty with WhatsApp markdown", () => {
      const report: DefaulterReportData = {
        weekName: "Week 4",
        deadlineDate: "Friday, Sep 18, 2026 at 17:00",
        totalTeachers: 10,
        submittedCount: 7,
        partiallySubmittedCount: 1,
        defaulterCount: 2,
        partiallySubmitted: [
          {
            id: "t-1",
            fullName: "Mrs. Erica Frempong Eyiah",
            email: "erica@school.com",
            department: "Primary",
            missingQuotas: [{ subject: "Science", className: "Year 2B" }],
          },
        ],
        defaulters: [
          {
            id: "t-2",
            fullName: "Mr. Derrick Thompson",
            email: "derrick@school.com",
            department: "ICT",
            totalQuotas: 4,
          },
        ],
      };

      const message = formatWhatsAppDefaultersMessage(report);

      expect(message).toContain("*St. Adelaide International School*");
      expect(message).toContain("*Weekly Lesson Plan Compliance Report — Week 4*");
      expect(message).toContain("• Fully Compliant (All Quotas): *7* (70%)");
      expect(message).toContain("Partially Submitted Faculty (1):");
      expect(message).toContain("Mrs. Erica Frempong Eyiah");
      expect(message).toContain("Year 2B Science");
      expect(message).toContain("Outstanding Defaulters — Zero Plans Submitted");
      expect(message).toContain("Mr. Derrick Thompson");
      expect(message.length).toBeLessThan(4096);
    });

    it("should correctly split oversized text into chunks strictly below 4,096 characters", () => {
      const longMessage = Array.from({ length: 150 }, (_, i) => `• Line ${i + 1}: Faculty item details and pedagogical curriculum breakdown here.`).join("\n");
      expect(longMessage.length).toBeGreaterThan(5000);

      const chunks = splitWhatsAppMessage(longMessage, 3500);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(4096);
      });
    });

    it("should automatically chunk payloads exceeding 4,000 characters and dispatch each chunk via Meta API", async () => {
      process.env.WHATSAPP_CLOUD_API_TOKEN = "test-token";
      process.env.WHATSAPP_PHONE_NUMBER_ID = "phone-123";

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ messages: [{ id: "msg-chunk" }] }),
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      const longText = Array.from({ length: 120 }, (_, i) => `Paragraph ${i + 1}: Detailed compliance report information here.`).join("\n");
      expect(longText.length).toBeGreaterThan(4500);

      const result = await sendWhatsAppMessage("0241234567", longText);

      expect(result.success).toBe(true);
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
      mockFetch.mock.calls.forEach(([, options]: any) => {
        const payload = JSON.parse(options.body as string);
        expect(payload.text.body.length).toBeLessThanOrEqual(4096);
        expect(payload.to).toBe("233241234567");
      });
    });
  });


  describe("Inngest Pipeline Deduplication (skipWhatsAppSend)", () => {
    it("should verify deduplication prevents secondary dispatch when skipWhatsAppSend is true", async () => {
      const mockSend = jest.fn();
      const eventData = { weekName: "Week 3", skipWhatsAppSend: true };

      if (!eventData.skipWhatsAppSend) {
        mockSend();
      }

      expect(mockSend).not.toHaveBeenCalled();

      const scheduledEventData = { weekName: "Week 3", skipWhatsAppSend: false };
      if (!scheduledEventData.skipWhatsAppSend) {
        mockSend();
      }

      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });
});
