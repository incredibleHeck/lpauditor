import { escapeMarkdown, formatDefaultersTelegramMessage, DefaulterReportData } from "@/lib/telegram";

describe("Telegram Notification Utility", () => {
  it("should escape special markdown characters properly", () => {
    const raw = "Special _ * [ ] ( ) ~ > # + - = | { } . ! characters";
    const escaped = escapeMarkdown(raw);
    expect(escaped).toContain("\\_");
    expect(escaped).toContain("\\*");
    expect(escaped).toContain("\\[");
    expect(escaped).toContain("\\]");
  });

  it("should format a full defaulter report markdown message with compliance percentage", () => {
    const report: DefaulterReportData = {
      weekName: "Week 3",
      deadlineDate: "Friday, Sep 4, 2026 at 17:00",
      totalTeachers: 10,
      submittedCount: 8,
      defaulterCount: 2,
      defaulters: [
        {
          id: "t-1",
          fullName: "Alice Mensah",
          email: "alicemensah@stadelaideschool.com",
          department: "Mathematics",
        },
        {
          id: "t-2",
          fullName: "Bob Kumi",
          email: "bobkumi@stadelaideschool.com",
          department: "History",
        },
      ],
    };

    const message = formatDefaultersTelegramMessage(report);

    expect(message).toContain("St. Adelaide International School");
    expect(message).toContain("Week 3");
    expect(message).toContain("80%"); // 8/10 = 80%
    expect(message).toContain("Alice Mensah");
    expect(message).toContain("Bob Kumi");
    expect(message).toContain("Mathematics");
    expect(message).toContain("History");
  });

  it("should format a 100% compliance celebration message when there are zero defaulters", () => {
    const report: DefaulterReportData = {
      weekName: "Week 4",
      deadlineDate: "Friday, Sep 11, 2026 at 17:00",
      totalTeachers: 5,
      submittedCount: 5,
      defaulterCount: 0,
      defaulters: [],
    };

    const message = formatDefaultersTelegramMessage(report);

    expect(message).toContain("100%");
    expect(message).toContain("All faculty members have submitted their lesson plans");
  });
});
