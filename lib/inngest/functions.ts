import { inngest } from "./client";
import { supabaseAdmin } from "../supabase-admin";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { GoogleAIFileManager, GoogleAICacheManager } from "@google/generative-ai/server";
import { CAMBRIDGE_RUBRIC_PROMPT } from "../rubric";
import fs from "fs";
import path from "path";
import os from "os";

/**
 * Lead AI Engineer: Phase 4 - Gemini 3 Flash Inference Worker
 * 
 * This worker implements the 6-step atomic pipeline for pedagogical auditing.
 * It leverages Gemini 3 Flash Preview / 1.5 Flash for multimodal document analysis,
 * using the Google Gen AI Context Caching API to cache standard rubrics.
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
    const { submissionId, fileUrl } = event.data;

    // Step 0: Mark as PROCESSING in Database
    await step.run("update-status-processing", async () => {
      const { error } = await supabaseAdmin
        .from('submissions')
        .update({ status: 'PROCESSING' })
        .eq('id', submissionId);
      
      if (error) throw new Error(`Failed to update status to PROCESSING: ${error.message}`);
    });

    // Step A: Download File from Supabase Storage
    const tempFilePath = await step.run("download-file", async () => {
      const { data, error } = await supabaseAdmin.storage
        .from('lesson-plans')
        .download(fileUrl);

      if (error) throw new Error(`Failed to download file from Supabase: ${error.message}`);

      const fileName = `${submissionId}_${path.basename(fileUrl)}`;
      const filePath = path.join(os.tmpdir(), fileName);
      
      // Convert Blob to Buffer and write to local temp storage
      const buffer = Buffer.from(await data.arrayBuffer());
      fs.writeFileSync(filePath, buffer);
      
      return filePath;
    });

    // Step B: Upload to Gemini File API for Multimodal Support
    const geminiFile = await step.run("upload-to-gemini", async () => {
      try {
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
        // Cleanup local temp file immediately after upload
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });

    try {
      // Step C: Deterministic Inference with Context Caching & Gemini
      const auditResult = await step.run("execute-audit", async () => {
        let model;
        let cacheHandle = null;

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

        // Attempt to retrieve or update the context cache
        try {
          const cacheManager = new GoogleAICacheManager(process.env.GEMINI_API_KEY!);
          const listResult = await cacheManager.list();
          const existing = listResult.cachedContents?.find(c => c.displayName === "cambridge-rubric-cache");
          
          if (existing && existing.name) {
            console.log("Context Cache found: extending TTL...");
            // Extend TTL by 1 hour (3600 seconds) on weekday usage
            await cacheManager.update(existing.name, { cachedContent: { ttlSeconds: 3600 } });
            cacheHandle = existing;
          } else {
            console.log("No cache found. Attempting to create cache...");
            // Explicit caching usually requires models like gemini-1.5-flash-001 or gemini-1.5-pro-001
            cacheHandle = await cacheManager.create({
              model: "models/gemini-1.5-flash-001",
              displayName: "cambridge-rubric-cache",
              contents: [
                { role: "user", parts: [{ text: CAMBRIDGE_RUBRIC_PROMPT }] }
              ],
              ttlSeconds: 3600
            });
          }
        } catch (cacheErr) {
          // Log and fallback to standard execution if caching fails
          console.warn("Context caching failed, falling back to inline system instruction:", cacheErr);
        }

        // Initialize appropriate model based on cache availability
        if (cacheHandle) {
          console.log("Initializing model using Cached Content:", cacheHandle.name);
          model = genAI.getGenerativeModelFromCachedContent(cacheHandle, {
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema,
            }
          });
        } else {
          console.log("Initializing standard model with inline system instructions...");
          model = genAI.getGenerativeModel({
            model: "gemini-3-flash-preview",
            systemInstruction: CAMBRIDGE_RUBRIC_PROMPT,
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema,
            },
          });
        }

        // Perform audit
        const result = await model.generateContent([
          {
            fileData: {
              mimeType: geminiFile.mimeType,
              fileUri: geminiFile.uri
            }
          },
          { text: "Please audit this uploaded lesson plan against the standard rubrics." }
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

    } catch (error: any) {
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
      // Step D: Garbage Collection (Gemini File API)
      // This runs regardless of success or failure to maintain quota.
      await step.run("cleanup-gemini-file", async () => {
        try {
          await fileManager.deleteFile(geminiFile.name);
        } catch (cleanupError) {
          console.error("Failed to cleanup Gemini file:", cleanupError);
        }
      });
    }
  }
);

/**
 * Cron function to pre-provision/refresh the Cambridge rubric context cache
 * every Monday at 06:00 AM.
 * 
 * Note: provisions for 5 days so it naturally expires Saturday morning, 
 * eliminating storage costs over the weekend.
 */
export const refreshRubricCacheCron = inngest.createFunction(
  { id: "refresh-rubric-cache-cron", triggers: [{ cron: "0 6 * * 1" }] },
  async ({ step }) => {
    await step.run("recreate-or-update-cache", async () => {
      const cacheManager = new GoogleAICacheManager(process.env.GEMINI_API_KEY!);
      
      // Delete existing cache if it exists, to re-provision
      try {
        const listResult = await cacheManager.list();
        const existing = listResult.cachedContents?.find(c => c.displayName === "cambridge-rubric-cache");
        if (existing && existing.name) {
          console.log("Pruning existing rubric cache for recreation...");
          await cacheManager.delete(existing.name);
        }
      } catch (e) {
        console.warn("No cache found to prune during cron run:", e);
      }

      // Re-create cache with long TTL (5 days = 432000 seconds)
      const cache = await cacheManager.create({
        model: "models/gemini-1.5-flash-001",
        displayName: "cambridge-rubric-cache",
        contents: [
          { role: "user", parts: [{ text: CAMBRIDGE_RUBRIC_PROMPT }] }
        ],
        ttlSeconds: 5 * 24 * 3600 // 5 days
      });
      
      console.log(`Cron: Created cache resource ${cache.name} successfully.`);
      return { cacheName: cache.name };
    });
  }
);
