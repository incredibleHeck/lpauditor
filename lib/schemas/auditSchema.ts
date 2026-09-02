import { SchemaType, ResponseSchema } from "@google/generative-ai";

export const auditResponseSchema: ResponseSchema = {
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
    },
    cambridge_attributes: {
      type: SchemaType.OBJECT,
      properties: {
        confident: { type: SchemaType.NUMBER, description: "Score 0-100 for student confidence and voice." },
        responsible: { type: SchemaType.NUMBER, description: "Score 0-100 for student ownership and peer review." },
        reflective: { type: SchemaType.NUMBER, description: "Score 0-100 for self-evaluation and exit tickets." },
        innovative: { type: SchemaType.NUMBER, description: "Score 0-100 for creative problem solving." },
        engaged: { type: SchemaType.NUMBER, description: "Score 0-100 for active inquiry and participation." }
      },
      required: ["confident", "responsible", "reflective", "innovative", "engaged"]
    },
    command_verbs: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Cambridge exam board command verbs identified (e.g., Analyze, Evaluate, Describe)."
    },
    cognitive_demand: {
      type: SchemaType.OBJECT,
      properties: {
        low_recall: { type: SchemaType.NUMBER, description: "Percentage of recall/copying activities." },
        medium_application: { type: SchemaType.NUMBER, description: "Percentage of application/guided practice." },
        high_evaluation: { type: SchemaType.NUMBER, description: "Percentage of high-order analysis/evaluation." }
      },
      required: ["low_recall", "medium_application", "high_evaluation"]
    },
    eal_scaffolding_score: {
      type: SchemaType.NUMBER,
      description: "Score 0-100 for English as an Additional Language (EAL/ESL) scaffolding quality."
    },
    time_compliance: {
      type: SchemaType.OBJECT,
      properties: {
        is_compliant: { type: SchemaType.BOOLEAN, description: "True if time allocations sum accurately and pacing is realistic." },
        total_allocated_minutes: { type: SchemaType.NUMBER, description: "Total minutes allocated across all lesson activities." },
        pacing_feedback: { type: SchemaType.STRING, description: "Detailed feedback on time management and lesson pacing." }
      },
      required: ["is_compliant", "total_allocated_minutes", "pacing_feedback"]
    },
    age_appropriateness: {
      type: SchemaType.OBJECT,
      properties: {
        score: { type: SchemaType.NUMBER, description: "Score 0-100 for developmental and grade-level appropriateness." },
        feedback: { type: SchemaType.STRING, description: "Evaluation of content difficulty, language level, and task suitability for the specified grade." }
      },
      required: ["score", "feedback"]
    },
    instructional_delivery: {
      type: SchemaType.OBJECT,
      properties: {
        teacher_student_ratio: { type: SchemaType.STRING, description: "Ratio of teacher-led modeling vs student active practice (e.g. 30% Teacher / 70% Student)." },
        methodology_notes: { type: SchemaType.STRING, description: "Overview of pedagogical teaching methods utilized." },
        step_by_step_tips: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: "Practical step-by-step guidance on how the teacher should execute this lesson."
        }
      },
      required: ["teacher_student_ratio", "methodology_notes", "step_by_step_tips"]
    }
  },
  required: [
    "score",
    "lessons_detected",
    "strengths",
    "flags",
    "summary",
    "cambridge_attributes",
    "command_verbs",
    "cognitive_demand",
    "eal_scaffolding_score",
    "time_compliance",
    "age_appropriateness",
    "instructional_delivery"
  ]
};

import { z } from "zod";

export const zodAuditResponseSchema = z.object({
  score: z.number().min(0).max(100).default(0),
  lessons_detected: z.number().min(1).default(1),
  strengths: z.array(z.string()).default([]),
  flags: z.array(z.string()).default([]),
  summary: z.string().default(""),
  cambridge_attributes: z
    .object({
      confident: z.number().min(0).max(100).default(50),
      responsible: z.number().min(0).max(100).default(50),
      reflective: z.number().min(0).max(100).default(50),
      innovative: z.number().min(0).max(100).default(50),
      engaged: z.number().min(0).max(100).default(50),
    })
    .nullable()
    .optional(),
  command_verbs: z.array(z.string()).default([]),
  cognitive_demand: z
    .object({
      low_recall: z.number().min(0).max(100).default(33),
      medium_application: z.number().min(0).max(100).default(33),
      high_evaluation: z.number().min(0).max(100).default(34),
    })
    .nullable()
    .optional(),
  eal_scaffolding_score: z.number().min(0).max(100).nullable().optional(),
  time_compliance: z
    .object({
      is_compliant: z.boolean().default(true),
      total_allocated_minutes: z.number().default(45),
      pacing_feedback: z.string().default(""),
    })
    .nullable()
    .optional(),
  age_appropriateness: z
    .object({
      score: z.number().min(0).max(100).default(80),
      feedback: z.string().default(""),
    })
    .nullable()
    .optional(),
  instructional_delivery: z
    .object({
      teacher_student_ratio: z.string().default("40% Direct / 60% Active Practice"),
      methodology_notes: z.string().default(""),
      step_by_step_tips: z.array(z.string()).default([]),
    })
    .nullable()
    .optional(),
});

export type ZodAuditResponse = z.infer<typeof zodAuditResponseSchema>;
