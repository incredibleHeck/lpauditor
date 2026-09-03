"use server";

import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { getDefaultersReportForWeek } from "@/lib/defaulters";
import {
  sendWhatsAppMessage,
  formatDefaultersWhatsAppMessage,
  generateWhatsAppNudgeUrl,
} from "@/lib/whatsapp";
import { inngest } from "@/lib/inngest/client";
import { logger } from "@/lib/logger";
import { defaultersReportSchema } from "@/lib/schemas/actionSchemas";
import { adminDb } from "@/lib/firebase-admin";

/**
 * Server Action: Fetches defaulter report for HOD and Admin UI dashboard.
 */
export async function getDefaultersReportAction(
  weekName?: string,
  departmentFilter?: string
) {
  try {
    const parsed = defaultersReportSchema.safeParse({ weekName, departmentFilter });
    const targetWeek = parsed.success ? parsed.data.weekName : weekName;
    const targetDept = parsed.success ? parsed.data.departmentFilter : departmentFilter;

    const user = await getAuthenticatedUser();
    if (user.role !== "HOD" && user.role !== "ADMIN") {
      throw new Error("Forbidden: Only HODs and Admins can view defaulters reports.");
    }

    const report = await getDefaultersReportForWeek(targetWeek, targetDept);
    return { success: true, data: report };
  } catch (err: unknown) {
    logger.error({ err, weekName, departmentFilter }, "Failed to get defaulters report");
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
      data: null,
    };
  }
}

/**
 * Server Action: Triggers WhatsApp notification with defaulters report for administration.
 */
export async function triggerWhatsAppDefaulterReportAction(
  weekName?: string,
  departmentFilter?: string
) {
  try {
    const parsed = defaultersReportSchema.safeParse({ weekName, departmentFilter });
    const targetWeek = parsed.success ? parsed.data.weekName : weekName;
    const targetDept = parsed.success ? parsed.data.departmentFilter : departmentFilter;

    const user = await getAuthenticatedUser();
    if (user.role !== "HOD" && user.role !== "ADMIN") {
      throw new Error("Forbidden: Only HODs and Admins can dispatch WhatsApp defaulters alerts.");
    }

    const report = await getDefaultersReportForWeek(targetWeek, targetDept);
    const messageText = formatDefaultersWhatsAppMessage(report);

    const adminRecipient = process.env.WHATSAPP_ADMIN_RECIPIENT_PHONE || "";
    // Send directly via official Meta WhatsApp Cloud API (or mocked fallback)
    const whatsAppResult = adminRecipient
      ? await sendWhatsAppMessage(adminRecipient, messageText)
      : await sendWhatsAppMessage(messageText);

    // Also send Inngest event for background audit logging (with skipWhatsAppSend flag to prevent duplicate alerts)
    await inngest.send({
      name: "defaulters.check",
      data: { weekName: targetWeek, triggeredBy: user.email || user.uid, skipWhatsAppSend: true },
    });

    logger.info(
      { triggeredBy: user.uid, weekName: targetWeek, success: whatsAppResult.success },
      "Dispatched WhatsApp defaulters report"
    );

    return {
      success: true,
      report,
      whatsAppResult,
    };
  } catch (err: unknown) {
    logger.error({ err, weekName, departmentFilter }, "Failed to trigger WhatsApp defaulter report");
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Server Action: Generates a 1-Click WhatsApp Nudge link for a specific teacher.
 */
export async function getWhatsAppNudgeLinkAction(
  teacherId: string,
  weekName: string = "this week"
) {
  try {
    const user = await getAuthenticatedUser();
    if (user.role !== "HOD" && user.role !== "ADMIN") {
      throw new Error("Forbidden: Only HODs and Admins can nudge teachers.");
    }

    const profileDoc = await adminDb.collection("profiles").doc(teacherId).get();
    if (!profileDoc.exists) {
      throw new Error("Teacher profile not found.");
    }

    const profile = profileDoc.data() || {};
    const phone = profile.phone || "";
    const fullName = profile.full_name || "Colleague";
    const expectedQuotas = profile.expected_quotas || [];

    // Find missing quotas for the current target week
    const report = await getDefaultersReportForWeek(weekName);
    const defaulter = [...(report.defaulters || []), ...(report.partiallySubmitted || [])].find(
      (d) => d.id === teacherId
    );
    const missingQuotas = defaulter?.missingQuotas || expectedQuotas;

    const url = generateWhatsAppNudgeUrl(phone, fullName, missingQuotas, weekName);

    return {
      success: true,
      url,
      hasPhone: Boolean(phone),
    };
  } catch (err: unknown) {
    logger.error({ err, teacherId }, "Failed to generate WhatsApp nudge link");
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
