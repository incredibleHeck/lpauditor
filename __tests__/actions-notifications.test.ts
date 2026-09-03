import {
  getDefaultersReportAction,
  triggerWhatsAppDefaulterReportAction,
  triggerTelegramDefaulterReportAction,
} from "@/app/actions/notifications";

jest.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    get: jest.fn(),
  },
}));

jest.mock("@/lib/auth-helpers", () => ({
  getAuthenticatedUser: jest.fn(),
}));

jest.mock("@/lib/defaulters", () => ({
  getDefaultersReportForWeek: jest.fn(),
}));

jest.mock("@/lib/whatsapp", () => ({
  sendWhatsAppMessage: jest.fn(),
  formatDefaultersWhatsAppMessage: jest.fn(),
  generateWhatsAppNudgeUrl: jest.fn(),
}));

jest.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: jest.fn().mockResolvedValue({}),
  },
}));

describe("Notifications & Defaulters Server Actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getDefaultersReportAction", () => {
    it("should reject regular teachers with Forbidden error", async () => {
      const { getAuthenticatedUser } = require("@/lib/auth-helpers");
      getAuthenticatedUser.mockResolvedValue({
        uid: "teacher-1",
        role: "TEACHER",
      });

      const result = await getDefaultersReportAction("Week 1");
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Forbidden/);
    });

    it("should allow HOD and Admin to fetch defaulters report", async () => {
      const { getAuthenticatedUser } = require("@/lib/auth-helpers");
      const { getDefaultersReportForWeek } = require("@/lib/defaulters");

      getAuthenticatedUser.mockResolvedValue({
        uid: "hod-1",
        role: "HOD",
        department: "Mathematics",
      });

      const mockReport = {
        weekName: "Week 1",
        deadlineDate: "Friday, Sep 4, 2026",
        totalTeachers: 12,
        submittedCount: 10,
        defaulterCount: 2,
        defaulters: [],
      };

      getDefaultersReportForWeek.mockResolvedValue(mockReport);

      const result = await getDefaultersReportAction("Week 1", "Mathematics");
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockReport);
      expect(getDefaultersReportForWeek).toHaveBeenCalledWith("Week 1", "Mathematics");
    });
  });

  describe("triggerWhatsAppDefaulterReportAction", () => {
    it("should block non-HOD/Admin users from sending alerts", async () => {
      const { getAuthenticatedUser } = require("@/lib/auth-helpers");
      getAuthenticatedUser.mockResolvedValue({
        uid: "teacher-1",
        role: "TEACHER",
      });

      const result = await triggerWhatsAppDefaulterReportAction("Week 2");
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Forbidden/);
    });

    it("should format report, send WhatsApp message, and dispatch Inngest audit event", async () => {
      const { getAuthenticatedUser } = require("@/lib/auth-helpers");
      const { getDefaultersReportForWeek } = require("@/lib/defaulters");
      const { formatDefaultersWhatsAppMessage, sendWhatsAppMessage } = require("@/lib/whatsapp");
      const { inngest } = require("@/lib/inngest/client");

      getAuthenticatedUser.mockResolvedValue({
        uid: "admin-1",
        email: "admin@school.com",
        role: "ADMIN",
      });

      const mockReport = {
        weekName: "Week 2",
        deadlineDate: "Friday, Sep 11, 2026",
        totalTeachers: 10,
        submittedCount: 8,
        defaulterCount: 2,
        defaulters: [
          { id: "t-1", fullName: "John Doe", email: "j@s.com", department: "Math" },
        ],
      };

      getDefaultersReportForWeek.mockResolvedValue(mockReport);
      formatDefaultersWhatsAppMessage.mockReturnValue("Mock formatted whatsapp message");
      sendWhatsAppMessage.mockResolvedValue({ success: true, messageId: "wa-999" });

      const result = await triggerWhatsAppDefaulterReportAction("Week 2", "Math");

      expect(result.success).toBe(true);
      expect(formatDefaultersWhatsAppMessage).toHaveBeenCalledWith(mockReport);
      expect(sendWhatsAppMessage).toHaveBeenCalledWith("Mock formatted whatsapp message");
      expect(inngest.send).toHaveBeenCalledWith({
        name: "defaulters.check",
        data: { weekName: "Week 2", triggeredBy: "admin@school.com", skipWhatsAppSend: true },
      });
      expect(result.whatsAppResult).toEqual({ success: true, messageId: "wa-999" });
    });

    it("should maintain backward-compatible alias triggerTelegramDefaulterReportAction", async () => {
      expect(triggerTelegramDefaulterReportAction).toBe(triggerWhatsAppDefaulterReportAction);
    });
  });
});
