import { zodAuditResponseSchema } from "@/lib/schemas/auditSchema";

describe("LLM Audit Response Zod Schema Validation", () => {
  it("should validate a complete valid LLM response", () => {
    const valid = {
      score: 82,
      lessons_detected: 2,
      strengths: ["Clear SMART verbs", "Well-scaffolded starter"],
      flags: [],
      summary: "High quality lesson plan",
      cambridge_attributes: {
        confident: 85,
        responsible: 80,
        reflective: 75,
        innovative: 90,
        engaged: 88,
      },
      command_verbs: ["Analyze", "Evaluate"],
      cognitive_demand: {
        low_recall: 20,
        medium_application: 40,
        high_evaluation: 40,
      },
      eal_scaffolding_score: 85,
      time_compliance: {
        is_compliant: true,
        total_allocated_minutes: 50,
        pacing_feedback: "Well-paced across all lesson segments",
      },
      age_appropriateness: {
        score: 90,
        feedback: "Content is well aligned with Grade 4 requirements",
      },
      instructional_delivery: {
        teacher_student_ratio: "30% Direct / 70% Student Inquiry",
        methodology_notes: "CPA approach followed consistently",
        step_by_step_tips: ["Use concrete manipulatives first", "Facilitate peer discussion"],
      },
    };

    const parsed = zodAuditResponseSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("should populate defaults for missing optional fields", () => {
    const minimal = {
      score: 45,
    };

    const parsed = zodAuditResponseSchema.safeParse(minimal);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.score).toBe(45);
      expect(parsed.data.lessons_detected).toBe(1);
      expect(parsed.data.strengths).toEqual([]);
      expect(parsed.data.flags).toEqual([]);
    }
  });

  it("should reject scores outside 0-100 range", () => {
    const invalid = {
      score: 150,
    };

    const parsed = zodAuditResponseSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });
});
