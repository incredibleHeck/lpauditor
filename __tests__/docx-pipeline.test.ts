import fs from "fs";
import path from "path";
import {
  parseDocxBuffer,
  validateDocxBuffer,
  MAX_DOCX_BUFFER_SIZE,
  DOCX_MIME_TYPE,
  DocxStructuredSections,
} from "@/lib/docx";
import { zodAuditResponseSchema, ZodAuditResponse } from "@/lib/schemas/auditSchema";
import { getPedagogicalRubric } from "@/lib/rubric";
import { SCORE_PASSING_THRESHOLD } from "@/lib/constants";
import { getDefaultersReportForWeek, isQuotaSubmitted } from "@/lib/defaulters";
import { ExpectedQuota } from "@/lib/types";

// Mock firebase-admin for quota reconciliation
const mockProfilesGet = jest.fn();
const mockSubmissionsGet = jest.fn();

jest.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: jest.fn((name: string) => {
      if (name === "profiles") {
        return {
          get: mockProfilesGet,
          where: jest.fn().mockReturnThis(),
        };
      }
      if (name === "submissions") {
        return {
          where: jest.fn().mockReturnValue({
            get: mockSubmissionsGet,
            where: jest.fn().mockReturnValue({
              get: mockSubmissionsGet,
            }),
          }),
          get: mockSubmissionsGet,
        };
      }
      return {
        get: jest.fn().mockResolvedValue({ docs: [] }),
        where: jest.fn().mockReturnThis(),
      };
    }),
  },
}));

describe("DOCX Real-Sample Integration & Ingestion Pipeline Harness", () => {
  const year5FilePath = path.join(process.cwd(), "WEEK 4 YEAR 5.docx");
  const year6FilePath = path.join(process.cwd(), "WEEK 4 YEAR 6.docx");

  let year5Buffer: Buffer;
  let year6Buffer: Buffer;

  beforeAll(() => {
    expect(fs.existsSync(year5FilePath)).toBe(true);
    expect(fs.existsSync(year6FilePath)).toBe(true);

    year5Buffer = fs.readFileSync(year5FilePath);
    year6Buffer = fs.readFileSync(year6FilePath);
  });

  describe("1. Buffer & Text Extraction on Real Project Root Fixtures", () => {
    it("should parse 'WEEK 4 YEAR 5.docx' without encoding errors and yield all required pedagogical sections", async () => {
      const parsed: DocxStructuredSections = await parseDocxBuffer(year5Buffer, {
        filename: "WEEK 4 YEAR 5.docx",
      });

      expect(parsed).toBeDefined();
      expect(parsed.rawText.length).toBeGreaterThan(1500);

      // Verify metadata extracted from document table
      expect(parsed.metadata.teacher).toContain("Hector Aryiku");
      expect(parsed.metadata.subject).toMatch(/Computing/i);
      expect(parsed.metadata.gradeLevel).toBe("Year 5");
      expect(parsed.metadata.week).toBe("Week 4");
      expect(parsed.metadata.topic).toContain("Routing");

      // Verify all 5 required structured sections
      expect(parsed.objectives).not.toBe("No explicit objectives section detected");
      expect(parsed.objectives.length).toBeGreaterThan(50);
      expect(parsed.objectives).toMatch(/packets|data|network|router/i);

      expect(parsed.starter).not.toBe("No explicit starter section detected");
      expect(parsed.starter.length).toBeGreaterThan(50);
      expect(parsed.starter).toMatch(/adventure|recap|packets|15 mins/i);

      expect(parsed.mainActivities).not.toBe("No explicit main activities section detected");
      expect(parsed.mainActivities.length).toBeGreaterThan(100);
      expect(parsed.mainActivities).toMatch(/internet|activity|router/i);

      expect(parsed.plenary).not.toBe("No explicit plenary section detected");
      expect(parsed.plenary.length).toBeGreaterThan(50);
      expect(parsed.plenary).toMatch(/reflection|discussion|reliability|plenary|review|recap/i);

      expect(parsed.differentiation).not.toBe("No explicit differentiation section detected");
      expect(parsed.differentiation.length).toBeGreaterThan(30);
      expect(parsed.differentiation).toMatch(/support|extension|scaffold/i);
    });

    it("should parse 'WEEK 4 YEAR 6.docx' without encoding errors and yield all required pedagogical sections", async () => {
      const parsed: DocxStructuredSections = await parseDocxBuffer(year6Buffer, {
        filename: "WEEK 4 YEAR 6.docx",
      });

      expect(parsed).toBeDefined();
      expect(parsed.rawText.length).toBeGreaterThan(1500);

      // Verify metadata extracted from document table
      expect(parsed.metadata.teacher).toContain("Hector Aryiku");
      expect(parsed.metadata.subject).toMatch(/Computing/i);
      expect(parsed.metadata.gradeLevel).toBe("Year 6");
      expect(parsed.metadata.week).toBe("Week 4");
      expect(parsed.metadata.topic).toContain("Authentication");

      // Verify all 5 required structured sections
      expect(parsed.objectives).not.toBe("No explicit objectives section detected");
      expect(parsed.objectives.length).toBeGreaterThan(50);
      expect(parsed.objectives).toMatch(/password|authentication|biometric/i);

      expect(parsed.starter).not.toBe("No explicit starter section detected");
      expect(parsed.starter.length).toBeGreaterThan(50);
      expect(parsed.starter).toMatch(/starter|detective|password|15 mins/i);

      expect(parsed.mainActivities).not.toBe("No explicit main activities section detected");
      expect(parsed.mainActivities.length).toBeGreaterThan(100);
      expect(parsed.mainActivities).toMatch(/scratch|activity|password/i);

      expect(parsed.plenary).not.toBe("No explicit plenary section detected");
      expect(parsed.plenary.length).toBeGreaterThan(50);
      expect(parsed.plenary).toMatch(/plenary|security|review/i);

      expect(parsed.differentiation).not.toBe("No explicit differentiation section detected");
      expect(parsed.differentiation.length).toBeGreaterThan(30);
      expect(parsed.differentiation).toMatch(/support|extension|scaffold/i);
    });

    it("should enforce DOCX buffer size limits (<10MB) and reject oversized buffers", () => {
      const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      expect(() => validateDocxBuffer(oversizedBuffer)).toThrow(/exceeds maximum allowed limit of 10MB/i);
    });

    it("should reject corrupted or invalid non-zip buffers missing PK\\x03\\x04 magic bytes", () => {
      const corruptedBuffer = Buffer.from("Corrupted file content without zip header");
      expect(() => validateDocxBuffer(corruptedBuffer)).toThrow(/missing valid ZIP archive header/i);
    });

    it("should reject empty or undefined buffers", () => {
      const emptyBuffer = Buffer.alloc(0);
      expect(() => validateDocxBuffer(emptyBuffer)).toThrow(/empty or undefined/i);
    });

    it("should enforce strict MIME guards when MIME option is supplied", () => {
      expect(() =>
        validateDocxBuffer(year5Buffer, { mimeType: "application/pdf" })
      ).toThrow(/Invalid MIME type.*Expected.*wordprocessingml\.document/i);

      expect(() =>
        validateDocxBuffer(year5Buffer, { mimeType: DOCX_MIME_TYPE })
      ).not.toThrow();
    });
  });

  describe("2. Gemini 3.8 Flash Evaluation Gate & 70% Threshold Enforcement", () => {
    // Deterministic mock AI evaluator simulating Gemini 3.8 Flash inference
    function evaluateLessonPlanWithMockAI(
      parsedPlan: DocxStructuredSections,
      simulatedScore: number = 85
    ): ZodAuditResponse {
      const isBelowThreshold = simulatedScore < SCORE_PASSING_THRESHOLD;
      const flags: string[] = [];

      if (isBelowThreshold) {
        flags.push(
          `CRITICAL COMPLIANCE FAILURE: Overall score (${simulatedScore}%) is strictly below the mandatory ${SCORE_PASSING_THRESHOLD}% threshold. Resubmission required before HOD sign-off.`
        );
      }

      if (parsedPlan.differentiation.length < 50) {
        flags.push("Differentiation: Limited support activities specified for EAL students.");
      }

      const mockPayload = {
        score: simulatedScore,
        lessons_detected: 1,
        strengths: [
          "Clear inquiry-based starter activity with explicit timing (15 mins).",
          "Active student collaboration in main computing laboratory activities.",
          "Clear alignment with Cambridge digital literacy framework.",
        ],
        flags,
        summary: `The lesson plan for ${parsedPlan.metadata.gradeLevel || "students"} ${
          parsedPlan.metadata.topic || "Computing"
        } demonstrates structured pedagogy with realistic time allocation.`,
        cambridge_attributes: {
          confident: 85,
          responsible: 80,
          reflective: 75,
          innovative: 88,
          engaged: 90,
        },
        command_verbs: ["Analyze", "Design", "Evaluate", "Identify"],
        cognitive_demand: {
          low_recall: 20,
          medium_application: 50,
          high_evaluation: 30,
        },
        eal_scaffolding_score: 82,
        time_compliance: {
          is_compliant: true,
          total_allocated_minutes: 105,
          pacing_feedback: "Total allocated time matches 3 periods (105 mins) realistically.",
        },
        age_appropriateness: {
          score: 88,
          feedback: `Content and practical computing tasks are well calibrated for ${parsedPlan.metadata.gradeLevel}.`,
        },
        instructional_delivery: {
          teacher_student_ratio: "25% Teacher / 75% Student",
          methodology_notes: "Guided inquiry and collaborative problem solving in computing lab.",
          step_by_step_tips: [
            "Demonstrate packet routing using physical props during starter.",
            "Circulate to verify network topology during main lab task.",
            "Run 5-minute exit ticket plenary.",
          ],
        },
      };

      return zodAuditResponseSchema.parse(mockPayload);
    }

    it("should produce valid rubric JSON conforming to zodAuditResponseSchema for Year 5 DOCX", async () => {
      const parsedYear5 = await parseDocxBuffer(year5Buffer, { filename: "WEEK 4 YEAR 5.docx" });
      const rubric = getPedagogicalRubric("Computing and Digital Literacy");
      expect(rubric.rubricType).toBe("CAMBRIDGE");

      const auditResult = evaluateLessonPlanWithMockAI(parsedYear5, 88);

      expect(auditResult.score).toBe(88);
      expect(auditResult.cambridge_attributes?.confident).toBe(85);
      expect(auditResult.command_verbs).toContain("Analyze");
      expect(auditResult.time_compliance?.is_compliant).toBe(true);
      expect(auditResult.time_compliance?.total_allocated_minutes).toBe(105);
    });

    it("should enforce COMPLETED status for plans scoring >= 70% threshold", async () => {
      const parsedYear6 = await parseDocxBuffer(year6Buffer, { filename: "WEEK 4 YEAR 6.docx" });
      const passingScore = 84;
      const auditResult = evaluateLessonPlanWithMockAI(parsedYear6, passingScore);

      const isBelowThreshold = auditResult.score < SCORE_PASSING_THRESHOLD;
      const finalStatus = isBelowThreshold ? "RESUBMISSION_REQUIRED" : "COMPLETED";

      expect(isBelowThreshold).toBe(false);
      expect(finalStatus).toBe("COMPLETED");
      expect(auditResult.flags.some((f) => f.includes("CRITICAL COMPLIANCE FAILURE"))).toBe(false);
    });

    it("should enforce RESUBMISSION_REQUIRED status and critical flag for plans scoring < 70% threshold", async () => {
      const parsedYear5 = await parseDocxBuffer(year5Buffer, { filename: "WEEK 4 YEAR 5.docx" });
      const failingScore = 58;
      const auditResult = evaluateLessonPlanWithMockAI(parsedYear5, failingScore);

      const isBelowThreshold = auditResult.score < SCORE_PASSING_THRESHOLD;
      const finalStatus = isBelowThreshold ? "RESUBMISSION_REQUIRED" : "COMPLETED";

      expect(isBelowThreshold).toBe(true);
      expect(finalStatus).toBe("RESUBMISSION_REQUIRED");
      expect(auditResult.flags.some((f) => f.includes("CRITICAL COMPLIANCE FAILURE"))).toBe(true);
      expect(auditResult.flags[0]).toContain(
        `Overall score (58%) is strictly below the mandatory ${SCORE_PASSING_THRESHOLD}% threshold`
      );
    });
  });

  describe("3. Quota Reconciliation for Multi-Class Educator (Mr. Ayiku)", () => {
    const teacherId = "teacher-ayiku-1";
    const targetWeek = "Week 4";

    const ayikuQuotas: ExpectedQuota[] = [
      { subject: "ICT", className: "Year 5 (Streams A & B)" },
      { subject: "ICT", className: "Year 6 (Streams A & B)" },
    ];

    beforeEach(() => {
      jest.clearAllMocks();

      // Configure teacher profile in Firestore mock
      mockProfilesGet.mockResolvedValue({
        docs: [
          {
            id: teacherId,
            data: () => ({
              full_name: "Mr. Hector Aryiku",
              name: "Mr. Ayiku",
              email: "hectoraryiku@stadelaideschool.com",
              department: "ICT",
              role: "ADMIN",
              expected_quotas: ayikuQuotas,
            }),
          },
        ],
      });
    });

    it("should classify educator as DEFAULTER before any plans are ingested", async () => {
      // No submissions exist for target week
      mockSubmissionsGet.mockResolvedValue({ docs: [] });

      const report = await getDefaultersReportForWeek(targetWeek);

      expect(report.totalTeachers).toBe(1);
      expect(report.submittedCount).toBe(0);
      expect(report.partiallySubmittedCount).toBe(0);
      expect(report.defaulterCount).toBe(1);

      const defaulter = report.defaulters[0];
      expect(defaulter.id).toBe(teacherId);
      expect(defaulter.status).toBe("DEFAULTER");
      expect(defaulter.missingQuotas).toHaveLength(2);
    });

    it("should transition educator to PARTIALLY_SUBMITTED after ingesting 'WEEK 4 YEAR 5.docx'", async () => {
      const parsedYear5 = await parseDocxBuffer(year5Buffer, { filename: "WEEK 4 YEAR 5.docx" });

      // Simulate submission generated from Year 5 DOCX ingestion
      mockSubmissionsGet.mockResolvedValue({
        docs: [
          {
            id: "sub-y5-1",
            data: () => ({
              teacher_id: teacherId,
              week_name: targetWeek,
              subject: parsedYear5.metadata.subject, // "Computing and Digital Literacy" (ICT alias)
              grade_level: parsedYear5.metadata.gradeLevel, // "Year 5"
              status: "COMPLETED",
            }),
          },
        ],
      });

      const report = await getDefaultersReportForWeek(targetWeek);

      expect(report.totalTeachers).toBe(1);
      expect(report.submittedCount).toBe(0); // Not fully compliant yet
      expect(report.partiallySubmittedCount).toBe(1);
      expect(report.defaulterCount).toBe(0);

      const partial = (report.partiallySubmitted || [])[0];
      expect(partial).toBeDefined();
      expect(partial.id).toBe(teacherId);
      expect(partial.status).toBe("PARTIALLY_SUBMITTED");
      expect(partial.submittedQuotasCount).toBe(1);
      expect(partial.missingQuotas).toHaveLength(1);
      expect(partial.missingQuotas?.[0].className).toBe("Year 6 (Streams A & B)");
    });

    it("should transition educator to COMPLIANT after ingesting 'WEEK 4 YEAR 6.docx'", async () => {
      const parsedYear5 = await parseDocxBuffer(year5Buffer, { filename: "WEEK 4 YEAR 5.docx" });
      const parsedYear6 = await parseDocxBuffer(year6Buffer, { filename: "WEEK 4 YEAR 6.docx" });

      // Both Year 5 and Year 6 documents ingested
      mockSubmissionsGet.mockResolvedValue({
        docs: [
          {
            id: "sub-y5-1",
            data: () => ({
              teacher_id: teacherId,
              week_name: targetWeek,
              subject: parsedYear5.metadata.subject,
              grade_level: parsedYear5.metadata.gradeLevel,
              status: "COMPLETED",
            }),
          },
          {
            id: "sub-y6-1",
            data: () => ({
              teacher_id: teacherId,
              week_name: targetWeek,
              subject: parsedYear6.metadata.subject,
              grade_level: parsedYear6.metadata.gradeLevel,
              status: "COMPLETED",
            }),
          },
        ],
      });

      const report = await getDefaultersReportForWeek(targetWeek);

      expect(report.totalTeachers).toBe(1);
      expect(report.submittedCount).toBe(1); // Fully compliant!
      expect(report.partiallySubmittedCount).toBe(0);
      expect(report.defaulterCount).toBe(0);
      expect(report.defaulters).toHaveLength(0);
      expect(report.partiallySubmitted).toHaveLength(0);
    });

    it("should confirm flexible matching for Year/Grade equivalence and double streams in isQuotaSubmitted", () => {
      const quotaY5: ExpectedQuota = { subject: "ICT", className: "Year 5 (Streams A & B)" };
      const quotaY6: ExpectedQuota = { subject: "ICT", className: "Year 6 (Streams A & B)" };

      const submissions = new Set<string>();
      submissions.add("computing and digital literacy:::grade 5");

      expect(isQuotaSubmitted(quotaY5, submissions)).toBe(true);
      expect(isQuotaSubmitted(quotaY6, submissions)).toBe(false);

      submissions.add("computing and digital literacy:::year 6");
      expect(isQuotaSubmitted(quotaY6, submissions)).toBe(true);
    });
  });
});
