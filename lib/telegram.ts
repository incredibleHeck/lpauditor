/**
 * Telegram Bot API Integration Helper
 * Used to dispatch automated compliance notifications & defaulters list to school administrators.
 */

export interface TelegramSendResult {
  success: boolean;
  messageId?: number;
  error?: string;
}

export interface DefaulterItem {
  id: string;
  fullName: string;
  email: string;
  department: string;
}

export interface DefaulterReportData {
  weekName: string;
  deadlineDate: string;
  totalTeachers: number;
  submittedCount: number;
  defaulterCount: number;
  defaulters: DefaulterItem[];
}

/**
 * Sends a message via Telegram Bot API using HTTPS fetch.
 */
export async function sendTelegramMessage(
  text: string,
  parseMode: "Markdown" | "HTML" = "Markdown"
): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn("Telegram notification skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set.");
    return {
      success: false,
      error: "Telegram credentials missing in environment variables (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)."
    };
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      console.error("Telegram API Error Response:", data);
      return {
        success: false,
        error: data.description || `Telegram API error status ${response.status}`
      };
    }

    return {
      success: true,
      messageId: data.result?.message_id
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error calling Telegram API";
    console.error("Failed to send Telegram message:", errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Formats a clean, readable Markdown message for Telegram defaulters alert.
 */
export function formatDefaultersTelegramMessage(report: DefaulterReportData): string {
  const { weekName, deadlineDate, totalTeachers, submittedCount, defaulterCount, defaulters } = report;
  const complianceRate = totalTeachers > 0 ? Math.round((submittedCount / totalTeachers) * 100) : 100;

  let msg = `🚨 *LESSON PLAN DEFAULTERS REPORT*\n`;
  msg += `📅 *Target Period:* ${weekName}\n`;
  msg += `⏰ *Deadline:* ${deadlineDate}\n\n`;

  msg += `📊 *Summary Statistics*\n`;
  msg += `• Total Registered Teachers: *${totalTeachers}*\n`;
  msg += `• Submissions Received: *${submittedCount}*\n`;
  msg += `• Defaulters: *${defaulterCount}*\n`;
  msg += `• Compliance Rate: *${complianceRate}%*\n\n`;

  if (defaulterCount === 0) {
    msg += `🎉 *Great job! All teachers have submitted their lesson plans on time.*`;
    return msg;
  }

  msg += `⚠️ *List of Defaulters (${defaulterCount}):*\n`;
  
  // Group defaulters by department
  const byDept: Record<string, DefaulterItem[]> = {};
  defaulters.forEach((d) => {
    const dept = d.department || "General / Unassigned";
    if (!byDept[dept]) byDept[dept] = [];
    byDept[dept].push(d);
  });

  Object.entries(byDept).forEach(([dept, list]) => {
    msg += `\n📌 *${dept}*\n`;
    list.forEach((item, idx) => {
      msg += `  ${idx + 1}. *${escapeMarkdown(item.fullName)}* (${escapeMarkdown(item.email)})\n`;
    });
  });

  msg += `\n👉 _HODs and Admins: Please remind defaulting teachers to submit their lesson plans immediately on LPAuditor._`;

  return msg;
}

/**
 * Escapes Markdown special characters to prevent Telegram formatting errors.
 */
function escapeMarkdown(text: string): string {
  return text.replace(/[_*`\[\]()]/g, "\\$&");
}
