import { inngest } from "../inngest";
import { uploadFileToGemini, geminiAudit, deleteGeminiFile } from "../gemini";
import { supabase } from "../supabase";

export const processLessonPlanAudit = inngest.createFunction(
  { 
    id: "process-lesson-audit", 
    retries: 3,
    onFailure: async ({ event, error, step }) => {
      const { submissionId } = event.data.event.data;
      await step.run("mark-as-failed", async () => {
        await supabase
          .from("submissions")
          .update({ 
            status: "FAILED",
          })
          .eq("id", submissionId);
      });
    }
  },
  { event: "lesson_plan.uploaded" },
  async ({ event, step }) => {
    const { uri, submissionId, rubric } = event.data;

    // Step 0: Update status to PROCESSING
    await step.run("update-status-processing", async () => {
      await supabase
        .from("submissions")
        .update({ status: "PROCESSING" })
        .eq("id", submissionId);
    });

    // Step 1: Ingest via Native File API
    const file = await step.run("upload-to-gemini", async () => {
      return await uploadFileToGemini(uri);
    });
    
    // Step 2: Audit with Structured Output
    const audit = await step.run("execute-audit", async () => {
      return await geminiAudit(file, rubric);
    });
    
    // Step 3: Commit to Postgres
    await step.run("save-results", async () => {
      // Save audit result
      const { error: auditError } = await supabase
        .from("ai_audits")
        .insert({
          submission_id: submissionId,
          compliance_score: audit.score,
          audit_payload: audit
        });

      if (auditError) throw auditError;

      // Update submission status to COMPLETED
      const { error: subError } = await supabase
        .from("submissions")
        .update({ status: "COMPLETED" })
        .eq("id", submissionId);

      if (subError) throw subError;
    });
    
    // Step 4: Garbage Collection
    await step.run("cleanup-file", async () => {
      await deleteGeminiFile(file.id);
    });

    return { success: true };
  }
);

// Cron Job: Provision and Refresh Context Cache (Mon-Fri 06:00 AM)
export const refreshContextCache = inngest.createFunction(
  { id: "refresh-context-cache" },
  { cron: "0 6 * * 1-5" }, // Monday-Friday at 6:00 AM
  async ({ step }) => {
    await step.run("refresh-cambridge-rubric", async () => {
      // Logic to call Gemini Context Caching API and update TTL
      console.log("Refreshing Cambridge Rubric Cache...");
    });
  }
);
