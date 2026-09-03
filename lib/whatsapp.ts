import { SCHOOL_NAME } from "./constants";
import { logger } from "./logger";
import { ExpectedQuota } from "./types";

/**
 * Result of a WhatsApp dispatch attempt
 */
export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  mocked?: boolean;
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
 * Normalizes a Ghanaian phone number to the international E.164 standard (e.g. 23324XXXXXXX).
 * Strips whitespace, dashes, and non-digit characters.
 * Automatically converts Ghanaian local prefixes (e.g. 024..., 050..., 020...) to 233...
 */
export function normalizeGhanaPhoneNumber(phone?: string | null): string {
  if (!phone) return "";
  // Strip non-digit characters
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";

  // If local Ghana number starting with 0 (e.g. 024XXXXXXX - 10 digits)
  if (digits.startsWith("0") && digits.length === 10) {
    return `233${digits.substring(1)}`;
  }

  // If already prefixed with 233
  if (digits.startsWith("233")) {
    return digits;
  }

  return digits;
}

/**
 * Backward-compatible alias for normalizeGhanaPhoneNumber
 */
export const normalizeWhatsAppPhoneNumber = normalizeGhanaPhoneNumber;

/**
 * Splits a long WhatsApp message into chunks strictly below 4,096 characters per bubble.
 */
export function splitWhatsAppMessage(message: string, maxChunkLength: number = 4000): string[] {
  if (!message) return [];
  if (message.length <= maxChunkLength) return [message];

  const lines = message.split("\n");
  const chunks: string[] = [];
  let currentChunk = "";

  for (const line of lines) {
    if ((currentChunk + "\n" + line).length > maxChunkLength && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = line;
    } else {
      currentChunk = currentChunk ? `${currentChunk}\n${line}` : line;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Formats a comprehensive lesson plan compliance report using WhatsApp markdown (*bold*, _italic_).
 * Categorizes into Compliant, Partially Submitted (with exact missing classes), and Defaulters.
 * Enforces Meta WhatsApp message character bounds (<4,096 characters per bubble).
 */
export function formatWhatsAppDefaultersMessage(report: DefaulterReportData): string {
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

  // Institutional Header
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

  // Partially Submitted Faculty Section (Exact missing classes)
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

  // Action Notice & Institutional Portal
  lines.push("⚠️ *Action Required:* Faculty with missing plans are requested to upload their curriculum on the portal immediately.");
  lines.push("🔗 *Portal:* https://lpauditor.stadelaideschool.com");

  let fullMessage = lines.join("\n");

  // Enforce Meta WhatsApp message character bounds (<4,096 characters per bubble)
  if (fullMessage.length > 4000) {
    fullMessage =
      fullMessage.slice(0, 3800) +
      `\n\n... _[Report truncated due to WhatsApp character limits. View complete breakdown on the LPAuditor portal.]_`;
  }

  return fullMessage;
}

/**
 * Backward-compatible alias for formatWhatsAppDefaultersMessage
 */
export const formatDefaultersWhatsAppMessage = formatWhatsAppDefaultersMessage;

/**
 * Generates a 1-Click WhatsApp Nudge URL (wa.me link).
 * Opens WhatsApp directly with a pre-filled professional reminder.
 * Format: https://wa.me/${cleanPhone}?text=${encodedText}
 */
export function generateWhatsAppNudgeUrl(
  phone: string,
  teacherName: string,
  missingQuotas: ExpectedQuota[] = [],
  weekName: string = "this week"
): string {
  const cleanPhone = normalizeGhanaPhoneNumber(phone);
  if (!cleanPhone) return "";

  let missingText = "";
  if (missingQuotas.length > 0) {
    const list = missingQuotas.map((q) => `${q.className} ${q.subject}`).join(" and ");
    missingText = ` for *${list}*`;
  }

  const message =
    `Hello ${teacherName}, this is a polite reminder from the St. Adelaide Academic Office. ` +
    `Please remember to submit your lesson plan${missingText} for *${weekName}* on the portal.\n\n` +
    `Kindly upload it before the close of day.\n` +
    `🔗 Portal Link: https://lpauditor.stadelaideschool.com`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Dispatches a text message via the official Meta WhatsApp Cloud API (Graph API v20.0).
 *
 * Supports two calling conventions:
 * 1. sendWhatsAppMessage(toPhone, messageBody)
 * 2. sendWhatsAppMessage(messageBody) -> defaults to WHATSAPP_ADMIN_RECIPIENT_PHONE
 *
 * Graceful Unconfigured Fallback:
 * If WHATSAPP_CLOUD_API_TOKEN or WHATSAPP_PHONE_NUMBER_ID is missing,
 * logs a structured warning via lib/logger.ts and returns { success: true, mocked: true }.
 */
export async function sendWhatsAppMessage(
  firstArg: string,
  secondArg?: string
): Promise<WhatsAppSendResult> {
  let toPhone: string;
  let messageBody: string;

  if (secondArg !== undefined) {
    toPhone = firstArg;
    messageBody = secondArg;
  } else {
    toPhone =
      process.env.WHATSAPP_ADMIN_RECIPIENT_PHONE ||
      process.env.WHATSAPP_RECIPIENT_PHONE ||
      process.env.WHATSAPP_ADMIN_PHONE ||
      "";
    messageBody = firstArg;
  }

  const apiToken = process.env.WHATSAPP_CLOUD_API_TOKEN || process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  // Graceful unconfigured fallback
  if (!apiToken || !phoneNumberId) {
    logger.warn(
      {
        hasToken: Boolean(apiToken),
        hasPhoneId: Boolean(phoneNumberId),
        toPhone: toPhone ? normalizeGhanaPhoneNumber(toPhone) : "unconfigured",
      },
      "Meta WhatsApp Cloud API credentials missing (WHATSAPP_CLOUD_API_TOKEN or WHATSAPP_PHONE_NUMBER_ID). Running in mocked mode."
    );

    return {
      success: true,
      mocked: true,
      simulated: true,
      messageId: `mock-wa-${Date.now()}`,
    };
  }

  const cleanE164Phone = normalizeGhanaPhoneNumber(toPhone);
  if (!cleanE164Phone) {
    logger.error({ toPhone }, "Invalid recipient phone number provided for WhatsApp dispatch");
    return {
      success: false,
      error: "Invalid recipient phone number for WhatsApp dispatch",
    };
  }

  const targetEndpoint = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

  try {
    const response = await fetch(targetEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanE164Phone,
        type: "text",
        text: {
          preview_url: false,
          body: messageBody,
        },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      logger.error(
        { status: response.status, body: errBody, endpoint: targetEndpoint },
        "Meta WhatsApp Cloud API request failed"
      );
      return {
        success: false,
        error: `Meta WhatsApp API error (${response.status}): ${errBody}`,
      };
    }

    const data = await response.json();
    const messageId = data.messages?.[0]?.id || `wa-msg-${Date.now()}`;

    logger.info(
      { recipient: cleanE164Phone, messageId },
      "Dispatched WhatsApp message successfully via Meta Cloud API v20.0"
    );

    return {
      success: true,
      messageId,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error({ error: errMsg }, "Exception while sending WhatsApp message via Meta Cloud API");
    return {
      success: false,
      error: errMsg,
    };
  }
}
