"use server";

import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { getDefaultersReportForWeek } from "@/lib/defaulters";
import { sendTelegramMessage, formatDefaultersTelegramMessage } from "@/lib/telegram";
import { inngest } from "@/lib/inngest/client";
import { logger } from "@/lib/logger";
import { defaultersReportSchema } from "@/lib/schemas/actionSchemas";

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
      data: null
    };
  }
}

/**
 * Server Action: Triggers Telegram notification with defaulters report for admins.
 */
export async function triggerTelegramDefaulterReportAction(
  weekName?: string,
  departmentFilter?: string
) {
  try {
    const parsed = defaultersReportSchema.safeParse({ weekName, departmentFilter });
    const targetWeek = parsed.success ? parsed.data.weekName : weekName;
    const targetDept = parsed.success ? parsed.data.departmentFilter : departmentFilter;

    const user = await getAuthenticatedUser();
    if (user.role !== "HOD" && user.role !== "ADMIN") {
      throw new Error("Forbidden: Only HODs and Admins can dispatch Telegram defaulters alerts.");
    }

    const report = await getDefaultersReportForWeek(targetWeek, targetDept);
    const messageText = formatDefaultersTelegramMessage(report);

    // Send directly via Telegram API
    const telegramResult = await sendTelegramMessage(messageText, "Markdown");

    // Also send Inngest event for background audit logging
    await inngest.send({
      name: "defaulters.check",
      data: { weekName: targetWeek, triggeredBy: user.email || user.uid }
    });

    logger.info({ triggeredBy: user.uid, weekName: targetWeek, success: telegramResult.success }, "Dispatched Telegram defaulters report");

    return {
      success: true,
      report,
      telegramResult
    };
  } catch (err: unknown) {
    logger.error({ err, weekName, departmentFilter }, "Failed to trigger Telegram defaulter report");
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error"
    };
  }
}
