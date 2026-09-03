import { SCHOOL_NAME } from "./constants";
import { logger } from "./logger";
import { ExpectedQuota } from "./types";

/**
 * Result of a WhatsApp dispatch attempt
 */
export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  simulated?: boolean;
  error?: string;
}

export interface DefaulterItem {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  department: string;
  status?: "COMPLIANT" | "PARTIALLY_SUBMITTED" | "DEFAULTER";
  totalQuotas?: number;
  submittedQuotasCount?: number;
  missingQuotas?: ExpectedQuota[];
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
 * Normalizes a Ghanaian or international phone number for WhatsApp
 * e.g. "024 123 4567" -> "233241234567"
 * e.g. "+233 24 123 4567" -> "233241234567"
 */
export function normalizeWhatsAppPhoneNumber(phone?: string | null): string {
  if (!phone) return "";
  // Remove all non-digits
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";

  // If local Ghana number starting with 0 (e.g. 024..., 050..., 020...)
  if (digits.startsWith("0") && digits.length === 10) {
    return `233${digits.substring(1)}`;
  }

  // If already starts with 233
  if (digits.startsWith("233")) {
    return digits;
  }

  return digits;
}

/**
 * Formats a comprehensive lesson plan compliance report using WhatsApp markdown
 * WhatsApp formatting: *bold*, _italic_, ~strikethrough~
 */
export function formatDefaultersWhatsAppMessage(report: DefaulterReportData): string {
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

  const fullyCompliantCount = submittedCount;
  const compliancePct =
    totalTeachers > 0
      ? Math.round((fullyCompliantCount / totalTeachers) * 100)
      : 0;

  const lines: string[] = [];

  // Header
  lines.push(`📚 *${SCHOOL_NAME}*`);
  lines.push(`📋 *Weekly Lesson Plan Compliance Report — ${weekName}*`);
  lines.push(`⏰ *Deadline:* ${deadlineDate}`);
  lines.push("");

  // Statistics Summary
  lines.push("*📊 Submission Summary:*");
  lines.push(`• Total Primary & Secondary Teachers: *${totalTeachers}*`);
  lines.push(`• Fully Compliant (All Quotas): *${fullyCompliantCount}* (${compliancePct}%)`);
  if (partiallySubmittedCount > 0) {
    lines.push(`• Partially Submitted: *${partiallySubmittedCount}*`);
  }
  lines.push(`• Outstanding Defaulters: *${defaulterCount}*`);
  lines.push("");

  // 100% Compliance Celebration
  if (defaulterCount === 0 && partiallySubmittedCount === 0) {
    lines.push("🎉 *Outstanding Achievement!* All faculty members have submitted their lesson plans for all assigned classes!");
    return lines.join("\n");
  }

  // Partially Submitted Faculty Section
  if (partiallySubmitted.length > 0) {
    lines.push(`⚠️ *Partially Submitted Faculty (${partiallySubmitted.length}):*`);
    partiallySubmitted.forEach((t) => {
      const missingList = (t.missingQuotas || [])
        .map((q) => `${q.className} ${q.subject}`)
        .join(", ");
      lines.push(`• *${t.fullName}* (${t.department})`);
      lines.push(`  ↳ Missing: _${missingList || "Specific class plans"}_`);
    });
    lines.push("");
  }

  // Defaulters Section (Zero Submissions)
  if (defaulters.length > 0) {
    lines.push(`🚨 *Outstanding Defaulters — Zero Plans Submitted (${defaulters.length}):*`);
    defaulters.forEach((t) => {
      const quotaNotice = t.totalQuotas ? ` — ${t.totalQuotas} plan(s) due` : "";
      lines.push(`• *${t.fullName}* (${t.department})${quotaNotice}`);
    });
    lines.push("");
  }

  // Action Notice
  lines.push("⚠️ *Action Required:* Faculty with missing plans are requested to upload their curriculum on the portal immediately.");
  lines.push("🔗 *Portal:* https://lpauditor.stadelaideschool.com");

  return lines.join("\n");
}

/**
 * Generates a 1-Click WhatsApp Nudge URL (wa.me link)
 * Opens WhatsApp directly with a pre-filled professional reminder.
 * Requires ZERO API keys or tokens.
 */
export function generateWhatsAppNudgeUrl(
  phone: string,
  teacherName: string,
  missingQuotas: ExpectedQuota[] = [],
  weekName: string = "this week"
): string {
  const normalizedPhone = normalizeWhatsAppPhoneNumber(phone);
  if (!normalizedPhone) return "";

  let missingText = "";
  if (missingQuotas.length > 0) {
    const list = missingQuotas.map((q) => `${q.className} ${q.subject}`).join(", ");
    missingText = ` for *${list}*`;
  }

  const message =
    `Hello ${teacherName}, this is a polite reminder from the St. Adelaide Academic Office. ` +
    `Your lesson plan submission${missingText} for *${weekName}* is pending on the portal.\n\n` +
    `Kindly upload it before the close of day.\n` +
    `🔗 Portal Link: https://lpauditor.stadelaideschool.com`;

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Sends a message via Meta WhatsApp Cloud API (Graph API)
 * If credentials are not configured, gracefully enters Simulated Mode.
 */
export async function sendWhatsAppMessage(
  text: string,
  recipientOverride?: string
): Promise<WhatsAppSendResult> {
  const apiToken = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const recipient =
    recipientOverride ||
    process.env.WHATSAPP_RECIPIENT_PHONE ||
    process.env.WHATSAPP_ADMIN_PHONE;

  // Graceful simulation mode when tokens are missing
  if (!apiToken || !phoneNumberId || !recipient) {
    logger.info(
      {
        hasToken: Boolean(apiToken),
        hasPhoneId: Boolean(phoneNumberId),
        hasRecipient: Boolean(recipient),
        messagePreview: text.substring(0, 100),
      },
      "Meta WhatsApp Cloud API credentials missing or not configured. Running in SIMULATED mode."
    );

    return {
      success: true,
      simulated: true,
      messageId: `sim-wa-${Date.now()}`,
    };
  }

  const normalizedRecipient = normalizeWhatsAppPhoneNumber(recipient);
  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: normalizedRecipient,
        type: "text",
        text: {
          preview_url: true,
          body: text,
        },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      logger.error({ status: response.status, body: errBody }, "Meta WhatsApp Cloud API request failed");
      return {
        success: false,
        error: `WhatsApp API error (${response.status}): ${errBody}`,
      };
    }

    const data = await response.json();
    const messageId = data.messages?.[0]?.id;

    logger.info(
      {
        recipient: normalizedRecipient,
        messageId,
      },
      "Dispatched WhatsApp message successfully via Meta Cloud API"
    );

    return {
      success: true,
      messageId,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error({ error: errMsg }, "Failed to dispatch WhatsApp message");
    return {
      success: false,
      error: errMsg,
    };
  }
}
