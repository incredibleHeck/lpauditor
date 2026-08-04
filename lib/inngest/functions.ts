import { inngest } from "./client";
import { adminDb, adminStorage } from "../firebase-admin";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { CAMBRIDGE_RUBRIC_PROMPT, CAMBRIDGE_SUBJECT_GUIDES } from "../rubric";
import fs from "fs";
import path from "path";
import os from "os";

/**
 * Pedagogical Audit Worker
 * 
 * Uses Gemini 3.6 Flash for multimodal document analysis with Google Firebase backend.
 */

// Initialize Gemini Clients (using Paid API key for Gemini 3.6 Flash)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!);

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
      const fileName = `${submissionId}_${path.basename(storagePath)}`;
      const tempFilePath = path.join(os.tmpdir(), fileName);

      try {
        const bucket = adminStorage.bucket();
        const file = bucket.file(storagePath);
        
        await file.download({ destination: tempFilePath });

        const mimeType = storagePath.endsWith('.pdf') 
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const responseSchema: any = {
          type: SchemaType.OBJECT,
          properties: {
            score: { 
              type: SchemaType.NUMBER,
              description: "A compliance score from 0-100 based on Cambridge standards."
            },
            lessons_detected: { 
              type: SchemaType.NUMBER,
              description: "The count of distinct lesson segments identified in the document."
            },
            strengths: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: "A list of identified pedagogical strengths."
            },
            flags: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: "A list of critical compliance failures or areas for improvement."
            },
            summary: { 
              type: SchemaType.STRING,
              description: "A concise executive summary of the audit findings."
            }
          },
          required: ["score", "lessons_detected", "strengths", "flags", "summary"]
        };

        const subjectGuide = CAMBRIDGE_SUBJECT_GUIDES[subject] || "";
        const combinedInstruction = `${CAMBRIDGE_RUBRIC_PROMPT}\n\n${subjectGuide}`;

        const model = genAI.getGenerativeModel({
          model: "gemini-3.6-flash",
          systemInstruction: combinedInstruction,
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema,
          },
        });

        const result = await model.generateContent([
          {
            fileData: {
              mimeType: geminiFile.mimeType,
              fileUri: geminiFile.uri
            }
          },
          { text: `Please audit this uploaded lesson plan for ${gradeLevel || 'students'} ${subject || ''} against standard rubrics. Ensure content is strictly age-appropriate and pedagogically aligned.` }
        ]);

        const responseText = result.response.text();
        return JSON.parse(responseText);
      });

      // Step E: Save to Firestore
      await step.run("save-results", async () => {
        // 1. Write AI Audit Results
        await adminDb.collection("ai_audits").add({
          submission_id: submissionId,
          score: auditResult.score,
          lessons_detected: auditResult.lessons_detected,
          strengths: auditResult.strengths,
          flags: auditResult.flags,
          raw_response: auditResult,
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
        console.error(`Audit failed for submission ${submissionId}:`, error);
        
        await adminDb.collection("submissions").doc(submissionId).update({
          status: "FAILED"
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
