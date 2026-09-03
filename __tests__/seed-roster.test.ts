jest.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    set: jest.fn().mockResolvedValue(undefined),
  },
  adminAuth: {},
}));

import path from "path";
import {
  parseFacultyFromFixture,
  deriveEmailFromName,
} from "@/scripts/seed-roster-from-fixture";

describe("Roster Fixture Ingestion & Rules-Check Suite", () => {
  const fixturePath = path.join(
    __dirname,
    "../scripts/diagnostics/fixtures/local/rules-check.json"
  );

  describe("Fixture Ingestion & Faculty Classification", () => {
    it("should successfully parse rules-check.json and ingest 37 active faculty members", () => {
      const { activeFaculty, zeroQuotaFaculty } = parseFacultyFromFixture(fixturePath);

      // 37 Primary and Secondary teaching faculty
      expect(activeFaculty).toHaveLength(37);

      // 2 Non-teaching leadership admins
      expect(zeroQuotaFaculty).toHaveLength(2);
      expect(zeroQuotaFaculty.some((f) => f.name === "Prince Dunyoh")).toBe(true);
      expect(zeroQuotaFaculty.some((f) => f.name === "Theodora Hammond")).toBe(true);
    });

    it("should correctly derive lowercase sanitized institutional email addresses", () => {
      expect(deriveEmailFromName("Mr. Derrick Thompson")).toBe("derrick.thompson@stadelaideschool.com");
      expect(deriveEmailFromName("Mrs. Abigail Sackey")).toBe("abigailsackey@stadelaideschool.com");
      expect(deriveEmailFromName("Mr. Ayiku")).toBe("hectoraryiku@stadelaideschool.com");
      expect(deriveEmailFromName("Miss Ruth Lartey")).toBe("ruth.lartey@stadelaideschool.com");
    });
  });

  describe("Administrative & Sectional HOD Role Overrides", () => {
    it("should apply administrator override for Mr. Ayiku (Hector Aryiku) with double stream collapse", () => {
      const { activeFaculty } = parseFacultyFromFixture(fixturePath);
      const ayiku = activeFaculty.find((t) => t.name === "Mr. Ayiku");

      expect(ayiku).toBeDefined();
      expect(ayiku?.email).toBe("hectoraryiku@stadelaideschool.com");
      expect(ayiku?.role).toBe("ADMIN");
      expect(ayiku?.department).toBe("ICT");

      // Collapsed from 7 raw periods to 4 cohort quotas
      expect(ayiku?.expected_quotas).toHaveLength(4);
      expect(ayiku?.expected_quotas.map((q) => q.className)).toEqual([
        "Year 5 (Streams A & B)",
        "Year 6 (Streams A & B)",
        "Year 7 (Streams A & B)",
        "Year 8",
      ]);
    });

    it("should configure sectional HOD overrides for Upper Primary, Lower Primary, and Lower Secondary", () => {
      const { activeFaculty } = parseFacultyFromFixture(fixturePath);

      // Upper Primary HOD: Mrs. Abigail Sackey
      const sackey = activeFaculty.find((t) => t.name === "Mrs. Abigail Sackey");
      expect(sackey).toBeDefined();
      expect(sackey?.role).toBe("HOD");
      expect(sackey?.department).toBe("Upper Primary");
      expect(sackey?.expected_quotas).toHaveLength(1);
      expect(sackey?.expected_quotas[0].className).toBe("Year 5 (Streams A & B)");

      // Lower Primary HOD: Mrs. Pauline Asante-Nti
      const pauline = activeFaculty.find((t) => t.name === "Mrs. Pauline Asante-Nti");
      expect(pauline).toBeDefined();
      expect(pauline?.role).toBe("HOD");
      expect(pauline?.department).toBe("Lower Primary");
      expect(pauline?.expected_quotas).toHaveLength(1);
      expect(pauline?.expected_quotas[0].className).toBe("Year 6 (Streams A & B)");

      // Lower Secondary HOD: Mrs. Joana Asiedua Amoh-Barimah
      const joana = activeFaculty.find((t) => t.name.includes("Joana Asiedua"));
      expect(joana).toBeDefined();
      expect(joana?.role).toBe("HOD");
      expect(joana?.department).toBe("Lower Secondary");
    });
  });
});
