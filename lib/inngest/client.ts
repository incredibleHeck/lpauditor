import { Inngest } from "inngest";

// Define the event schema for type safety
export type Events = {
  "lesson_plan.uploaded": {
    data: {
      submissionId: string;
      fileUrl: string;
      filePath?: string;
      subject: string;
      weekName: string;
      gradeLevel?: string;
    };
  };
  "defaulters.check": {
    data: {
      weekName?: string;
      triggeredBy?: string;
    };
  };
};

// Initialize the Inngest client
export const inngest = new Inngest({ id: "lpauditor" });
