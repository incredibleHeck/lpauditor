jest.mock("@/lib/firebase-admin", () => ({
  adminAuth: {
    getUserByEmail: jest.fn(),
    createUser: jest.fn(),
    generatePasswordResetLink: jest.fn(),
    setCustomUserClaims: jest.fn(),
  },
  adminDb: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        set: jest.fn().mockResolvedValue(undefined),
      })),
    })),
  },
}));

import { parseResponsesCSV, loadExtractedRoster } from "@/scripts/provision-faculty-logins";

describe("Faculty Login Provisioning Engine", () => {
  describe("parseResponsesCSV", () => {
    it("should parse Google Form responses with standard headers", () => {
      const sampleCSV = `Timestamp,Select Your Official Full Name,Official School Email Address,Phone Number / WhatsApp
9/3/2026 12:00:01,Mr. Ayiku,hectoraryiku@stadelaideschool.com,+233 24 123 4567
9/3/2026 12:02:15,Mrs. Abigail Sackey,abigailsackey@stadelaideschool.com,+233 24 234 5678
9/3/2026 12:05:30,"Mrs. Promise Ankrah",promise.ankrah@stadelaideschool.com,"+233 24 345 6789"`;

      const rows = parseResponsesCSV(sampleCSV);

      expect(rows).toHaveLength(3);
      expect(rows[0].name).toBe("Mr. Ayiku");
      expect(rows[0].email).toBe("hectoraryiku@stadelaideschool.com");
      expect(rows[0].phone).toBe("+233 24 123 4567");

      expect(rows[1].name).toBe("Mrs. Abigail Sackey");
      expect(rows[1].email).toBe("abigailsackey@stadelaideschool.com");

      expect(rows[2].name).toBe("Mrs. Promise Ankrah");
      expect(rows[2].email).toBe("promise.ankrah@stadelaideschool.com");
      expect(rows[2].phone).toBe("+233 24 345 6789");
    });

    it("should handle alternative or shorter headers gracefully", () => {
      const sampleCSV = `Timestamp,Name,Email,Phone
9/3/2026 12:00:01,Samuel,samuel@stadelaideschool.com,0241112233`;

      const rows = parseResponsesCSV(sampleCSV);

      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe("Samuel");
      expect(rows[0].email).toBe("samuel@stadelaideschool.com");
      expect(rows[0].phone).toBe("0241112233");
    });

    it("should return empty array for empty or header-only CSV", () => {
      expect(parseResponsesCSV("")).toHaveLength(0);
      expect(parseResponsesCSV("Name,Email")).toHaveLength(0);
    });
  });

  describe("loadExtractedRoster", () => {
    it("should map teachers by normalized name and preserve assigned quotas", () => {
      const rosterMap = loadExtractedRoster();

      expect(rosterMap.size).toBeGreaterThan(30);

      const ayiku = rosterMap.get("mr. ayiku");
      expect(ayiku).toBeDefined();
      expect(ayiku?.department).toBe("ICT");
      expect(ayiku?.expected_quotas.length).toBe(4); // Double streams collapsed (Year 5, 6, 7 Streams A & B + Year 8)

      const ruth = rosterMap.get("miss ruth lartey");
      expect(ruth).toBeDefined();
      expect(ruth?.assigned_subjects).toContain("PE");
      expect(ruth?.expected_quotas.length).toBe(8); // Joint PE collapsed

      const sackey = rosterMap.get("mrs. abigail sackey");
      expect(sackey).toBeDefined();
      expect(sackey?.role).toBe("HOD");
      expect(sackey?.department).toBe("Upper Primary");
      expect(sackey?.expected_quotas.length).toBe(1); // Year 5 (Streams A & B) Math

      const pauline = rosterMap.get("mrs. pauline asante-nti");
      expect(pauline).toBeDefined();
      expect(pauline?.role).toBe("HOD");
      expect(pauline?.department).toBe("Lower Primary");
      expect(pauline?.expected_quotas.length).toBe(1); // Year 4 (Streams A & B) English

      const joana = rosterMap.get("mrs. joana asiedua amoh-barimah");
      expect(joana).toBeDefined();
      expect(joana?.role).toBe("HOD");
      expect(joana?.department).toBe("Lower Secondary");
      expect(joana?.expected_quotas.length).toBe(2); // Year 7 (Streams A & B) + Year 8 English
    });
  });
});
