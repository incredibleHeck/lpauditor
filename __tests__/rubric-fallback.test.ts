import { getPedagogicalRubric } from "@/lib/rubric";
import { DEPARTMENTS } from "@/lib/constants";

describe("Pedagogical Rubric Selector & Fallback Logic", () => {
  it("should return Cambridge rubric for all official configured departments", () => {
    for (const dept of DEPARTMENTS) {
      const result = getPedagogicalRubric(dept);
      expect(result.rubricType).toBe("CAMBRIDGE");
      expect(result.rubricPrompt).toContain("Cambridge International Standard");
      expect(result.subjectYardstick).toContain("YARDSTICK");
      expect(result.combinedInstruction).toContain(result.subjectYardstick);
    }
  });

  it("should return General Pedagogical fallback for unconfigured or custom subjects", () => {
    const customSubjects = ["Social Studies", "Religious Knowledge", "Economics", "Unknown Subject", ""];
    for (const subj of customSubjects) {
      const result = getPedagogicalRubric(subj);
      expect(result.rubricType).toBe("GENERAL_PEDAGOGICAL");
      expect(result.rubricPrompt).toContain("Universal Best-Practice Pedagogical Standards");
      expect(result.subjectYardstick).toContain("GENERAL SUBJECT PEDAGOGY YARDSTICK");
    }
  });
});
