import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
// Import your functions here
import { processLessonPlanAudit, refreshContextCache } from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processLessonPlanAudit,
    refreshContextCache,
  ],
});
