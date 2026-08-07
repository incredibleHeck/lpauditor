import { inngest } from "./client";
import { adminDb, adminStorage } from "../firebase-admin";
import { SchemaType, ResponseSchema } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { CAMBRIDGE_RUBRIC_PROMPT, CAMBRIDGE_SUBJECT_GUIDES } from "../rubric";
import { getDefaultersReportForWeek } from "../defaulters";
import { sendTelegramMessage, formatDefaultersTelegramMessage } from "../telegram";
import { getGeminiClient } from "../gemini";
import fs from "fs";
import path from "path";
import os from "os";
import { auditResponseSchema } from "../schemas/auditSchema";

/**
 * Pedagogical Audit Worker
 * 
 * Uses Gemini 3.6 Flash for multimodal document analysis with Google Firebase backend.
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
    const { submissionId, fileUrl, filePath, subject, gradeLevel } = event.data;

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
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    let isSuccess = false;
    try {
      // Step C: Inference with Gemini 3.6 Flash
      const auditResult = await step.run("execute-audit", async () => {

        const subjectGuide = CAMBRIDGE_SUBJECT_GUIDES[subject] || "";
        const combinedInstruction = `${CAMBRIDGE_RUBRIC_PROMPT}\n\n${subjectGuide}`;

        const model = getGeminiClient().getGenerativeModel({
          model: "gemini-3.6-flash",
          systemInstruction: combinedInstruction,
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
          { text: `Please audit this uploaded lesson plan for ${gradeLevel || 'students'} ${subject || ''} against standard rubrics. Carefully evaluate time compliance/pacing feasibility, age-appropriateness, and instructional delivery guidance.` }
        ]);

        const responseText = result.response.text();
        return JSON.parse(responseText);
      });

      // Step E: Save to Firestore
      await step.run("save-results", async () => {
        // 1. Write AI Audit Results with strict undefined guards
        await adminDb.collection("ai_audits").add({
          submission_id: submissionId,
          score: typeof auditResult.score === "number" ? auditResult.score : 0,
          lessons_detected: typeof auditResult.lessons_detected === "number" ? auditResult.lessons_detected : 1,
          strengths: Array.isArray(auditResult.strengths) ? auditResult.strengths : [],
          flags: Array.isArray(auditResult.flags) ? auditResult.flags : [],
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

        // 2. Mark Submission as COMPLETED
        await adminDb.collection("submissions").doc(submissionId).update({
          status: "COMPLETED"
        });
      });

      isSuccess = true;
      return { status: "success", submissionId };

    } catch (error: unknown) {
      // Step F: Failure Handler
      await step.run("handle-failure", async () => {
        const errorMsg = error instanceof Error ? error.message : "Unknown audit processing failure";
        console.error(`Audit failed for submission ${submissionId}:`, error);
        
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
          } catch (cleanupError) {
            console.error(`Failed to cleanup Gemini file ${geminiFile.name}:`, cleanupError);
          }
        });
      }
    }
  }
);

/**
 * Automated Defaulters Telegram Report Function
 * Triggers on a weekly cron schedule (Friday 17:00) or manually via 'defaulters.check' event.
 */
export const checkAndReportDefaulters = inngest.createFunction(
  {
    id: "check-and-report-defaulters",
    retries: 2,
    triggers: [
      { cron: "0 17 * * 5" }, // Every Friday at 17:00 UTC
      { event: "defaulters.check" } // Manual trigger event
    ]
  },
  async ({ event, step }) => {
    const eventData = event.data as { weekName?: string } | undefined;
    const weekName = eventData?.weekName;

    // Step 1: Compute defaulters report
    const report = await step.run("fetch-defaulters-data", async () => {
      return await getDefaultersReportForWeek(weekName);
    });

    // Step 2: Format and send Telegram alert
    const telegramResult = await step.run("send-telegram-alert", async () => {
      const messageText = formatDefaultersTelegramMessage(report);
      return await sendTelegramMessage(messageText, "Markdown");
    });

    return {
      status: telegramResult.success ? "success" : "warning",
      report,
      telegramResult
    };
  }
);

