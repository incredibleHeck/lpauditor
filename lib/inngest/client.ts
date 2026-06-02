import { Inngest } from "inngest";

// Define the event schema for type safety
export type Events = {
  "lesson_plan.uploaded": {
    data: {
      submissionId: string;
      fileUrl: string;
      subject: string;
      weekName: string;
    };
  };
};

// Initialize the Inngest client
export const inngest = new Inngest({ 
  id: "lpauditor",
  schemas: (s: any) => ({
    "lesson_plan.uploaded": s.object({
      submissionId: s.string(),
      fileUrl: s.string(),
      subject: s.string(),
      weekName: s.string(),
    }),
  }),
});
