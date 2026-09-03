import { SCHOOL_NAME } from "./constants";
import { logger } from "./logger";

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
  status?: "COMPLIANT" | "PARTIALLY_SUBMITTED" | "DEFAULTER";
  totalQuotas?: number;
  submittedQuotasCount?: number;
  missingQuotas?: { subject: string; className: string }[];
}

export interface DefaulterReportData {
  weekName: string;
  deadlineDate: string;
  totalTeachers: number;
  submittedCount: number;
  partiallySubmittedCount?: number;
  defaulterCount: number;
  defaulters: DefaulterItem[];
  partiallySubmitted?: DefaulterItem[];
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
    logger.warn("Telegram credentials not set (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing). Skipping dispatch.");
    return { success: false, error: "Telegram credentials not configured" };
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      logger.error({ status: res.status, body: errBody }, "Failed to send Telegram message");
      return { success: false, error: `Telegram API error: ${res.status}` };
    }

    const data = await res.json();
    return { success: true, messageId: data.result?.message_id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Exception while sending Telegram message");
    return { success: false, error: message };
  }
}

/**
 * Formats a clean, readable Markdown message for Telegram defaulters alert.
 */
export function formatDefaultersTelegramMessage(report: DefaulterReportData): string {
  const {
    weekName,
    deadlineDate,
    totalTeachers,
    submittedCount,
    partiallySubmittedCount = 0,
    defaulterCount,
    defaulters,
    partiallySubmitted = [],
  } = report;
  const complianceRate = totalTeachers > 0 ? Math.round((submittedCount / totalTeachers) * 100) : 100;

  let msg = `🚨 *${escapeMarkdown(SCHOOL_NAME)}*\n`;
  msg += `📋 *LESSON PLAN DEFAULTERS REPORT*\n`;
  msg += `📅 *Target Period:* ${escapeMarkdown(weekName)}\n`;
  msg += `⏰ *Deadline:* ${escapeMarkdown(deadlineDate)}\n\n`;

  msg += `📊 *Summary Statistics*\n`;
  msg += `• Total Registered Teachers: *${totalTeachers}*\n`;
  msg += `• Submissions Received: *${submittedCount}*\n`;
  if (partiallySubmittedCount > 0) {
    msg += `• Partially Submitted: *${partiallySubmittedCount}*\n`;
  }
  msg += `• Defaulters: *${defaulterCount}*\n`;
  msg += `• Compliance Rate: *${complianceRate}%*\n\n`;

  if (defaulterCount === 0 && partiallySubmitted.length === 0) {
    msg += `🎉 *Great job! All faculty members have submitted their lesson plans on time.*`;
    return msg;
  }

  // 1. Itemize Partially Submitted Teachers (if any)
  if (partiallySubmitted.length > 0) {
    msg += `⚠️ *Partially Submitted Faculty (${partiallySubmitted.length}):*\n`;
    partiallySubmitted.forEach((item, idx) => {
      const missingStr = (item.missingQuotas || [])
        .map((q) => `${q.className} ${q.subject}`)
        .join(", ");
      msg += `  ${idx + 1}. *${escapeMarkdown(item.fullName)}* (${escapeMarkdown(item.email)})\n`;
      if (missingStr) {
        msg += `     ↳ _Missing: ${escapeMarkdown(missingStr)}_\n`;
      }
    });
    msg += `\n`;
  }

  // 2. Full Defaulters
  if (defaulterCount > 0) {
    msg += `⚠️ *List of Defaulters (${defaulterCount}):*\n`;
    
    // Group defaulters by department
    const byDept: Record<string, DefaulterItem[]> = {};
    defaulters.forEach((d) => {
      const dept = d.department || "General / Unassigned";
      if (!byDept[dept]) byDept[dept] = [];
      byDept[dept].push(d);
    });

    Object.entries(byDept).forEach(([dept, list]) => {
      msg += `\n📌 *${escapeMarkdown(dept)}*\n`;
      list.forEach((item, idx) => {
        msg += `  ${idx + 1}. *${escapeMarkdown(item.fullName)}* (${escapeMarkdown(item.email)})\n`;
      });
    });
  }

  msg += `\n👉 _HODs and Admins: Please remind defaulting teachers to submit their lesson plans immediately on LPAuditor._`;

  // Telegram 4096-character limit guard: truncate safely with portal link notice
  if (msg.length > 3900) {
    msg = msg.slice(0, 3800) + `\n\n... _[Report truncated due to Telegram size limit. Please view the full breakdown on the LPAuditor dashboard.]_`;
  }

  return msg;
}

/**
 * Escapes Markdown special characters to prevent Telegram formatting errors.
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/[_*`\[\]()]/g, "\\$&");
}
