import { inngest } from "./client";
import { adminDb, adminStorage } from "../firebase-admin";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { getPedagogicalRubric } from "../rubric";
import { getDefaultersReportForWeek } from "../defaulters";
import { sendWhatsAppMessage, formatDefaultersWhatsAppMessage, WhatsAppSendResult } from "../whatsapp";
import { getGeminiClient } from "../gemini";
import { SCORE_PASSING_THRESHOLD, GEMINI_AUDIT_MODEL } from "../constants";
import { logger } from "@/lib/logger";
import fs from "fs";
import path from "path";
import os from "os";
import { auditResponseSchema, zodAuditResponseSchema, ZodAuditResponse } from "../schemas/auditSchema";

/**
 * Pedagogical Audit Worker
 * 
 * Uses Gemini 3.7 Flash for multimodal document analysis with Google Firebase backend.
 */

// Initialize Gemini File Manager
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY || "");

export const processLessonPlanAudit = inngest.createFunction(
  { 
    id: "process-lesson-audit", 
    retries: 3,
    triggers: [{ event: "lesson_plan.uploaded" }] 
  },
  async ({ event, step }) => {
    const { submissionId, fileUrl, filePath, subject, gradeLevel, teacherId } = event.data;

    // Step 0: Mark as PROCESSING in Firestore
    await step.run("update-status-processing", async () => {
      await adminDb.collection("submissions").doc(submissionId).update({
        status: "PROCESSING"
      });
    });

    // Step A & B: Download file from Firebase Storage and upload to Gemini File API
    const geminiFile = await step.run("retrieve-and-upload-to-gemini", async () => {
      const storagePath = filePath || fileUrl;
      const cleanPath = storagePath.split('?')[0].toLowerCase();
      const fileName = `${submissionId}_${path.basename(cleanPath)}`;
      const tempFilePath = path.join(os.tmpdir(), fileName);

      try {
        const bucket = adminStorage.bucket();
        const file = bucket.file(storagePath);
        
        await file.download({ destination: tempFilePath });

        const mimeType = cleanPath.endsWith('.pdf') 
          ? 'application/pdf' 
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

        const uploadResult = await fileManager.uploadFile(tempFilePath, {
          mimeType,
          displayName: `Lesson Plan ${submissionId}`,
        });

        return {
          uri: uploadResult.file.uri,
          name: uploadResult.file.name,
          mimeType: uploadResult.file.mimeType
        };
      } catch (err: unknown) {
        logger.error({ err, submissionId }, "Failed to upload document to Gemini");
        throw new Error("Failed to upload document to Gemini.");
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    let isSuccess = false;
    try {
      const rubricInfo = getPedagogicalRubric(subject);

      // Step C: Inference with Gemini 3.8 Flash and runtime Zod validation
      const auditResult: ZodAuditResponse = await step.run("execute-audit", async () => {
        const ai = getGeminiClient();
        const model = ai.getGenerativeModel({
          model: GEMINI_AUDIT_MODEL,
          systemInstruction: rubricInfo.combinedInstruction,
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: auditResponseSchema,
          },
        });

        const result = await model.generateContent([
          {
            fileData: {
              mimeType: geminiFile.mimeType,
              fileUri: geminiFile.uri
            }
          },
          { text: `Please audit this uploaded lesson plan for ${gradeLevel || 'students'} ${subject || ''} against standard rubrics (${rubricInfo.rubricType}). Carefully evaluate time compliance/pacing feasibility, age-appropriateness, and instructional delivery guidance.` }
        ]);

        const responseText = result.response.text();
        let rawParsed: unknown;
        try {
          rawParsed = JSON.parse(responseText);
        } catch (parseErr) {
          logger.error({ parseErr, responseText, submissionId }, "Failed to parse JSON response from Gemini");
          throw new Error("Gemini returned invalid or unparseable JSON.");
        }

        const validation = zodAuditResponseSchema.safeParse(rawParsed);
        if (!validation.success) {
          logger.warn({ issues: validation.error.issues, rawParsed, submissionId }, "LLM response failed strict schema validation; applying fallback defaults");
          // Re-parse with best effort defaults
          return typeof rawParsed === "object" && rawParsed !== null
            ? (rawParsed as ZodAuditResponse)
            : zodAuditResponseSchema.parse({});
        }

        return validation.data;
      });

      // Step E: Save to Firestore & Enforce Automated 70% Resubmission Threshold Gate
      await step.run("save-results", async () => {
        const score = typeof auditResult.score === "number" ? auditResult.score : 0;
        const isBelowThreshold = score < SCORE_PASSING_THRESHOLD;
        const finalStatus = isBelowThreshold ? "RESUBMISSION_REQUIRED" : "COMPLETED";

        const processedFlags = Array.isArray(auditResult.flags) ? [...auditResult.flags] : [];
        if (isBelowThreshold) {
          processedFlags.unshift(
            `CRITICAL COMPLIANCE FAILURE: Overall score (${score}%) is strictly below the mandatory ${SCORE_PASSING_THRESHOLD}% threshold. Resubmission required before HOD sign-off.`
          );
        }

        // 1. Write AI Audit Results with strict undefined guards
        await adminDb.collection("ai_audits").add({
          submission_id: submissionId,
          teacher_id: teacherId,
          subject: subject,
          rubric_type: rubricInfo.rubricType,
          score: score,
          lessons_detected: typeof auditResult.lessons_detected === "number" ? auditResult.lessons_detected : 1,
          strengths: Array.isArray(auditResult.strengths) ? auditResult.strengths : [],
          flags: processedFlags,
          cambridge_attributes: auditResult.cambridge_attributes || null,
          command_verbs: Array.isArray(auditResult.command_verbs) ? auditResult.command_verbs : [],
          cognitive_demand: auditResult.cognitive_demand || null,
          eal_scaffolding_score: typeof auditResult.eal_scaffolding_score === "number" ? auditResult.eal_scaffolding_score : null,
          time_compliance: auditResult.time_compliance || null,
          age_appropriateness: auditResult.age_appropriateness || null,
          instructional_delivery: auditResult.instructional_delivery || null,
          raw_response: auditResult || {},
          created_at: new Date()
        });

        // 2. Mark Submission with threshold status and auto-decision if failed
        await adminDb.collection("submissions").doc(submissionId).update({
          status: finalStatus,
          requires_resubmission: isBelowThreshold,
          score_threshold_met: !isBelowThreshold,
          hod_decision: isBelowThreshold ? "REVISION_REQUESTED" : null,
          hod_feedback: isBelowThreshold 
            ? `Automated Resubmission Gate: Compliance score (${score}%) is below the required ${SCORE_PASSING_THRESHOLD}% threshold. Please revise and resubmit.` 
            : null,
          updated_at: new Date()
        });
      });

      isSuccess = true;
      return { status: "success", submissionId };

    } catch (error: unknown) {
      // Step F: Failure Handler
      await step.run("handle-failure", async () => {
        logger.error({ error, submissionId }, "Audit processing failed permanently");
        const errorMsg = error instanceof Error ? error.message : "Unknown audit processing failure";
        
        await adminDb.collection("submissions").doc(submissionId).update({
          status: "FAILED",
          error_message: errorMsg
        });
      });
      
      throw error;

    } finally {
      if (isSuccess && geminiFile) {
        // Step D: Garbage Collection
        await step.run("cleanup-gemini-file", async () => {
          try {
            await fileManager.deleteFile(geminiFile.name);
          } catch (err: unknown) {
            logger.error({ err, submissionId }, `Failed to cleanup Gemini file ${geminiFile.name}`);
          }
        });
      }
    }
  }
);

/**
 * Automated Defaulters WhatsApp Report Function
 * Triggers on a weekly cron schedule (Friday 17:00) or manually via 'defaulters.check' event.
 */
export const checkAndReportDefaulters = inngest.createFunction(
  {
    id: "check-and-report-defaulters",
    retries: 2,
    triggers: [
      { cron: "0 17 * * 5" }, // Every Friday at 17:00 UTC
      { event: "defaulters.check" }, // Manual trigger event
    ],
  },
  async ({ event, step }) => {
    const eventData = event.data as
      | { weekName?: string; skipWhatsAppSend?: boolean; skipTelegramSend?: boolean }
      | undefined;
    const weekName = eventData?.weekName;

    // Step 1: Compute defaulters report
    const report = await step.run("fetch-defaulters-data", async () => {
      return await getDefaultersReportForWeek(weekName);
    });

    // Step 2: Format and send WhatsApp alert (skipped if manual trigger already dispatched it)
    let whatsAppResult: WhatsAppSendResult = { success: true };
    if (!eventData?.skipWhatsAppSend && !eventData?.skipTelegramSend) {
      whatsAppResult = await step.run("send-whatsapp-alert", async () => {
        const messageText = formatDefaultersWhatsAppMessage(report);
        return await sendWhatsAppMessage(messageText);
      });
    }

    return {
      status: whatsAppResult.success ? "success" : "warning",
      report,
      whatsAppResult,
      telegramResult: whatsAppResult, // Backward-compatible alias
    };
  }
);
