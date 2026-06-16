import { inngest } from "./client";
import { supabaseAdmin } from "../supabase-admin";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { CAMBRIDGE_RUBRIC_PROMPT, CAMBRIDGE_SUBJECT_GUIDES } from "../rubric";
import fs from "fs";
import path from "path";
import os from "os";

/**
 * Lead AI Engineer: Phase 4 - Gemini 3.5 Flash Inference Worker
 * 
 * This worker implements the 6-step atomic pipeline for pedagogical auditing.
 * It leverages Gemini 3.5 Flash for multimodal document analysis.
 */

// Initialize Gemini Clients
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY!);

export const processLessonPlanAudit = inngest.createFunction(
  { 
    id: "process-lesson-audit", 
    retries: 3,
    triggers: [{ event: "lesson_plan.uploaded" }] 
  },
  async ({ event, step }) => {
    const { submissionId, fileUrl, subject, gradeLevel } = event.data;

    // Step 0: Mark as PROCESSING in Database
    await step.run("update-status-processing", async () => {
      const { error } = await supabaseAdmin
        .from('submissions')
        .update({ status: 'PROCESSING' })
        .eq('id', submissionId);
      
      if (error) throw new Error(`Failed to update status to PROCESSING: ${error.message}`);
    });

    // Combined Step A & B: Download file and upload to Gemini File API in one execution step
    const geminiFile = await step.run("retrieve-and-upload-to-gemini", async () => {
      const { data, error } = await supabaseAdmin.storage
        .from('lesson-plans')
        .download(fileUrl);

      if (error) throw new Error(`Failed to download file from Supabase: ${error.message}`);

      const fileName = `${submissionId}_${path.basename(fileUrl)}`;
      const tempFilePath = path.join(os.tmpdir(), fileName);
      
      try {
        // Use Node streams to pipe the Blob data without exhausting memory
        const readableWebStream = data.stream();
        const writeStream = fs.createWriteStream(tempFilePath);
        
        // Convert Web Stream to Async Iterable to pipe to Node WriteStream
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for await (const chunk of readableWebStream as any) {
          if (!writeStream.write(chunk)) {
            await new Promise((resolve) => writeStream.once('drain', resolve));
          }
        }
        writeStream.end();
        
        await new Promise((resolve, reject) => {
          writeStream.on("finish", resolve);
          writeStream.on("error", reject);
        });

        const uploadResult = await fileManager.uploadFile(tempFilePath, {
          mimeType: fileUrl.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          displayName: `Lesson Plan ${submissionId}`,
        });

        return {
          uri: uploadResult.file.uri,
          name: uploadResult.file.name,
          mimeType: uploadResult.file.mimeType
        };
      } finally {
        // Clean up temp file immediately inside the same execution block
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    try {
      // Step C: Deterministic Inference with Gemini 3.5 Flash
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

        // Dynamically assemble system instruction with subject-specific yardstick
        const subjectGuide = CAMBRIDGE_SUBJECT_GUIDES[subject] || "";
        const combinedInstruction = `${CAMBRIDGE_RUBRIC_PROMPT}\n\n${subjectGuide}`;

        const model = genAI.getGenerativeModel({
          model: "gemini-3.5-flash",
          systemInstruction: combinedInstruction,
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema,
          },
        });

        // Perform audit
        const result = await model.generateContent([
          {
            fileData: {
              mimeType: geminiFile.mimeType,
              fileUri: geminiFile.uri
            }
          },
          { text: `Please audit this uploaded lesson plan for ${gradeLevel || 'students'} ${subject || ''} against the standard rubrics. Ensure the content is strictly age-appropriate and pedagogically aligned for this specific grade and subject.` }
        ]);

        const responseText = result.response.text();
        return JSON.parse(responseText);
      });

      // Step E: Database Commit (Success Case)
      await step.run("save-results", async () => {
        // 1. Log AI Audit Results
        const { error: auditError } = await supabaseAdmin
          .from('ai_audits')
          .insert({
            submission_id: submissionId,
            score: auditResult.score,
            lessons_detected: auditResult.lessons_detected,
            strengths: auditResult.strengths,
            flags: auditResult.flags,
            raw_response: auditResult // Stores the entire JSON including summary
          });

        if (auditError) throw new Error(`Failed to save AI audit results: ${auditError.message}`);

        // 2. Mark Submission as COMPLETED
        const { error: subError } = await supabaseAdmin
          .from('submissions')
          .update({ status: 'COMPLETED' })
          .eq('id', submissionId);

        if (subError) throw new Error(`Failed to finalize submission status: ${subError.message}`);
      });

      return { status: "success", submissionId };

    } catch (error: unknown) {
      // Step F: Failure Handler (Graceful degradation)
      await step.run("handle-failure", async () => {
        console.error(`Audit failed for submission ${submissionId}:`, error);
        
        await supabaseAdmin
          .from('submissions')
          .update({ status: 'FAILED' })
          .eq('id', submissionId);
      });
      
      throw error; // Re-throw to allow Inngest retries if configured

    } finally {
      // Step D: Targeted Garbage Collection (Gemini File API)
      await step.run("cleanup-gemini-file", async () => {
        try {
          console.log(`Cleaning up Gemini file ${geminiFile.name} for submission ${submissionId}...`);
          await fileManager.deleteFile(geminiFile.name);
          console.log(`Deleted orphaned Gemini file: ${geminiFile.name}`);
        } catch (cleanupError) {
          console.error(`Failed to cleanup Gemini file ${geminiFile.name}:`, cleanupError);
        }
      });
    }
  }
);
