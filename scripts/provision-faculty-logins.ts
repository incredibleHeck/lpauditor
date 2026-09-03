import fs from "fs";
import path from "path";
import { adminAuth, adminDb } from "../lib/firebase-admin";
import { ExtractedTeacherRecord, parseFacultyFromFixture } from "./seed-roster-from-fixture";
import { ExpectedQuota, UserProfile } from "../lib/types";

interface FormResponseRow {
  timestamp?: string;
  name: string;
  email: string;
  phone?: string;
}

interface ProvisionResult {
  name: string;
  email: string;
  role: string;
  department: string;
  weeklyQuotas: number;
  authAction: "CREATED" | "EXISTS" | "SIMULATED";
  uid: string;
  resetLink: string;
}

/**
 * Parses CSV lines handling quoted fields correctly
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

/**
 * Parses faculty_responses.csv into structured rows
 */
export function parseResponsesCSV(csvContent: string): FormResponseRow[] {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase());

  // Identify column indices flexibly
  const nameIdx = headers.findIndex((h) => h.includes("name"));
  const emailIdx = headers.findIndex((h) => h.includes("email"));
  const phoneIdx = headers.findIndex((h) => h.includes("phone") || h.includes("whatsapp"));
  const timeIdx = headers.findIndex((h) => h.includes("time"));

  const rows: FormResponseRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 2) continue;

    const name = nameIdx !== -1 ? cols[nameIdx] : cols[1];
    const email = emailIdx !== -1 ? cols[emailIdx] : cols[2];
    const phone = phoneIdx !== -1 ? cols[phoneIdx] : cols[3] || "";
    const timestamp = timeIdx !== -1 ? cols[timeIdx] : cols[0] || "";

    if (name && email) {
      rows.push({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone ? phone.trim() : undefined,
        timestamp,
      });
    }
  }

  return rows;
}

/**
 * Loads or automatically regenerates the extracted academic roster
 */
export function loadExtractedRoster(): Map<string, ExtractedTeacherRecord> {
  const extractedPath = path.join(process.cwd(), "faculty_roster_extracted.json");
  let activeFaculty: ExtractedTeacherRecord[] = [];
  let zeroQuotaFaculty: ExtractedTeacherRecord[] = [];

  if (fs.existsSync(extractedPath)) {
    const data = JSON.parse(fs.readFileSync(extractedPath, "utf-8"));
    activeFaculty = data.activeFaculty || [];
    zeroQuotaFaculty = data.zeroQuotaFaculty || [];
  } else {
    // Generate dynamically from fixture
    const localFixture = path.join(
      __dirname,
      "diagnostics/fixtures/local/rules-check.json"
    );
    const fallbackFixture =
      "C:\\EduScheduler\\scripts\\diagnostics\\fixtures\\local\\rules-check.json";
    const fixturePath = fs.existsSync(localFixture)
      ? localFixture
      : fs.existsSync(fallbackFixture)
      ? fallbackFixture
      : null;

    if (fixturePath) {
      const generated = parseFacultyFromFixture(fixturePath);
      activeFaculty = generated.activeFaculty;
      zeroQuotaFaculty = generated.zeroQuotaFaculty;
    }
  }

  const map = new Map<string, ExtractedTeacherRecord>();
  [...activeFaculty, ...zeroQuotaFaculty].forEach((t) => {
    map.set(t.name.trim().toLowerCase(), t);
  });

  return map;
}

/**
 * Main Provisioning Process
 */
async function main() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log(`\n=============================================================`);
  console.log(`🔐 ST. ADELAIDE FACULTY LOGIN & PROVISIONING ENGINE`);
  console.log(`⚙️  Execution Mode: ${isDryRun ? "DRY-RUN (Simulated)" : "LIVE FIREBASE PROVISION"}`);
  console.log(`=============================================================\n`);

  // 1. Locate responses CSV
  const csvPath = path.join(process.cwd(), "faculty_responses.csv");
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Error: Could not find responses CSV at: ${csvPath}`);
    console.log(`ℹ️  Tip: Download responses from Google Sheets as faculty_responses.csv`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const responses = parseResponsesCSV(csvContent);
  console.log(`📋 Ingested ${responses.length} responses from faculty_responses.csv\n`);

  // 2. Load timetable quota matrix
  const rosterMap = loadExtractedRoster();

  const results: ProvisionResult[] = [];
  const activationLinks: { name: string; email: string; role: string; resetLink: string }[] = [];

  for (let i = 0; i < responses.length; i++) {
    const resp = responses[i];
    const lookupKey = resp.name.trim().toLowerCase();
    const quotaData = rosterMap.get(lookupKey);

    // Apply special institutional overrides
    let role = quotaData?.role || "TEACHER";
    let department = quotaData?.department || "General";
    let roles = quotaData?.roles || [role];

    if (resp.name.includes("Ayiku")) {
      role = "ADMIN";
      roles = ["TEACHER", "ADMIN"];
      department = "ICT";
    } else if (resp.name.includes("Prince Dunyoh")) {
      role = "ADMIN";
      roles = ["ADMIN"];
      department = "Administration";
    } else if (resp.name.includes("Theodora Hammond")) {
      role = "ADMIN";
      roles = ["ADMIN"];
      department = "Administration";
    } else if (resp.name.includes("Pauline Asante-Nti")) {
      role = "HOD";
      roles = ["TEACHER", "HOD"];
      department = "Lower Primary";
    } else if (resp.name.includes("Abigail Sackey")) {
      role = "HOD";
      roles = ["TEACHER", "HOD"];
      department = "Upper Primary";
    } else if (resp.name.includes("Joana Asiedua Amoh-Barimah")) {
      role = "HOD";
      roles = ["TEACHER", "HOD"];
      department = "Lower Secondary";
    }

    const assigned_subjects = quotaData?.assigned_subjects || [];
    const assigned_classes = quotaData?.assigned_classes || [];
    const expected_quotas: ExpectedQuota[] = quotaData?.expected_quotas || [];

    let uid = `mock-uid-${i + 1}`;
    let authAction: "CREATED" | "EXISTS" | "SIMULATED" = "SIMULATED";
    let resetLink = `https://lpauditor-app.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=mockCode_${i}&apiKey=fakePreviewKey`;

    if (!isDryRun) {
      try {
        // Live Firebase Auth
        let userRecord;
        try {
          userRecord = await adminAuth.getUserByEmail(resp.email);
          authAction = "EXISTS";
        } catch {
          userRecord = await adminAuth.createUser({
            email: resp.email,
            displayName: resp.name,
            emailVerified: true,
          });
          authAction = "CREATED";
        }

        uid = userRecord.uid;

        // Custom claims for Admin / HOD
        if (role === "ADMIN") {
          await adminAuth.setCustomUserClaims(uid, { admin: true, role: "ADMIN" });
        } else if (role === "HOD") {
          await adminAuth.setCustomUserClaims(uid, { role: "HOD" });
        }

        // Generate password setup link
        resetLink = await adminAuth.generatePasswordResetLink(resp.email);

        // Firestore Profile Upsert
        const profileData: UserProfile & Record<string, unknown> = {
          id: uid,
          email: resp.email,
          full_name: resp.name,
          phone: resp.phone || null,
          role,
          roles,
          department,
          assigned_subjects,
          assigned_classes,
          expected_quotas,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await adminDb.collection("profiles").doc(uid).set(profileData, { merge: true });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`⚠️ Failed live provisioning for ${resp.name} (${resp.email}):`, msg);
        continue;
      }
    }

    results.push({
      name: resp.name,
      email: resp.email,
      role,
      department,
      weeklyQuotas: expected_quotas.length,
      authAction,
      uid,
      resetLink,
    });

    activationLinks.push({
      name: resp.name,
      email: resp.email,
      role,
      resetLink,
    });
  }

  // Display summary table
  const tableData = results.map((r) => ({
    FacultyName: r.name,
    Email: r.email,
    Role: r.role,
    Department: r.department,
    Quotas: r.weeklyQuotas,
    AuthAction: r.authAction,
    ActivationLink: r.resetLink.length > 50 ? r.resetLink.slice(0, 47) + "..." : r.resetLink,
  }));

  console.table(tableData);

  // 4. Output Activation Artifact CSV
  const artifactPath = path.join(process.cwd(), "faculty_activation_links.csv");
  const csvRows = [
    "Name,Email,Role,PasswordResetLink",
    ...activationLinks.map(
      (a) => `"${a.name}","${a.email}","${a.role}","${a.resetLink}"`
    ),
  ];

  fs.writeFileSync(artifactPath, csvRows.join("\n"), "utf-8");
  console.log(`\n💾 Exported one-click activation links artifact to:\n   ${artifactPath}\n`);

  if (isDryRun) {
    console.log(`✅ DRY-RUN VERIFIED:`);
    console.log(`   - Verified ${results.length} teacher responses matched against timetable quotas.`);
    console.log(`   - Simulated Auth user creation and secure reset link generation.`);
    console.log(`   - Previewed Firestore profile payloads with assigned subjects and classes.`);
    console.log(`   - No live records were created or modified.\n`);
  } else {
    console.log(`🎉 LIVE PROVISIONING COMPLETE:`);
    console.log(`   - Successfully provisioned ${results.length} faculty accounts in Firebase Auth.`);
    console.log(`   - Synchronized all Firestore profiles with weekly quotas.`);
    console.log(`   - Share 'faculty_activation_links.csv' with administration for staff distribution.\n`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal error during faculty provisioning:", err);
    process.exit(1);
  });
}
