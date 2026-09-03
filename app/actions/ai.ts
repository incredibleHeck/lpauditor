"use server";

import { adminDb } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { getGeminiClient } from "@/lib/gemini";
import { fetchAuditsForSubmissions } from "./submissions";
import {
  SCORE_PASSING_THRESHOLD,
  DIVISION_CLASSES,
  GEMINI_CHAT_MODEL,
  GEMINI_SYNTHESIS_MODEL,
} from "@/lib/constants";
import { logger } from "@/lib/logger";
import { 
  chatWithAuditorSchema, 
  departmentAnalyticsSchema
} from "@/lib/schemas/actionSchemas";

/**
 * Handle multi-turn pedagogical chat with Gemini 3.7 Flash using audit findings.
 */
export async function chatWithAuditor(
  submissionId: string,
  history: { role: "user" | "model"; text: string }[],
  userMessage: string
) {
  try {
    const parsed = chatWithAuditorSchema.safeParse({ submissionId, history, userMessage });
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
      return { success: false, error: `Validation Error: ${errorMsg}` };
    }

    const user = await getAuthenticatedUser();
    const doc = await adminDb.collection("submissions").doc(submissionId).get();
    if (!doc.exists) {
      throw new Error("Submission not found.");
    }
    const submission = doc.data()!;

    if (submission.teacher_id !== user.uid && user.department !== submission.subject && user.role !== "ADMIN") {
      throw new Error("Forbidden: You do not have permission to chat with this submission auditor.");
    }

    const auditSnapshot = await adminDb
      .collection("ai_audits")
      .where("submission_id", "==", submissionId)
      .limit(1)
      .get();

    if (auditSnapshot.empty) {
      throw new Error("No audit report found for this submission yet.");
    }

    const audit = auditSnapshot.docs[0].data();

    const genAI = getGeminiClient();
    const systemInstruction = `You are the HecTech Lesson Plan Auditor assistant. You are helping a teacher improve their lesson plan based on their recent audit results.
Here is the lesson plan context:
- Subject: ${submission.subject}
- Grade Level: ${submission.grade_level}
- Week: ${submission.week_name}

Here are the AI Audit Findings for this lesson plan:
- Compliance Score: ${audit.score}%
- Distinct Lessons Detected: ${audit.lessons_detected}
- Key Pedagogical Strengths: ${JSON.stringify(audit.strengths)}
- Compliance Flags/Failures: ${JSON.stringify(audit.flags)}
- Executive Summary: ${audit.raw_response?.summary || ""}

Use this context to guide the teacher. When they ask questions, provide clear, actionable, and specific suggestions matching Cambridge standards to fix their flags and build on their strengths. Do not make generic recommendations. Provide markdown-formatted responses with bullet points. Be concise, supportive, and direct.`;

    const model = genAI.getGenerativeModel({
      model: GEMINI_CHAT_MODEL,
      systemInstruction,
    });

    const sanitizedHistory: { role: "user" | "model"; parts: { text: string }[] }[] = [];
    for (const h of history) {
      if (!h.text || !h.text.trim()) continue;
      const role = h.role === "model" ? "model" : "user";
      if (sanitizedHistory.length === 0 && role === "model") {
        continue;
      }
      const lastRole = sanitizedHistory.length > 0 ? sanitizedHistory[sanitizedHistory.length - 1].role : null;
      if (lastRole === role) {
        sanitizedHistory[sanitizedHistory.length - 1].parts[0].text += `\n${h.text}`;
      } else {
        sanitizedHistory.push({ role, parts: [{ text: h.text }] });
      }
    }

    const chat = model.startChat({
      history: sanitizedHistory,
    });

    const result = await chat.sendMessage(userMessage);
    const reply = result.response.text();

    return { success: true, reply };
  } catch (err: unknown) {
    logger.error({ err, submissionId }, "Chat with auditor action failed");
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Generates statistics and a weekly brief/synthesis for HOD view using Gemini 3.7 Flash.
 */
export async function getDepartmentAnalytics(departmentFilter: string = "All") {
  try {
    const parsed = departmentAnalyticsSchema.safeParse({ departmentFilter });
    const targetDept = parsed.success ? parsed.data.departmentFilter : departmentFilter;

    const user = await getAuthenticatedUser();
    const isDivision = Boolean(DIVISION_CLASSES[targetDept]);

    // Sandbox Local Demo Handling
    if (user.uid.startsWith("demo-")) {
      return {
        success: true,
        data: {
          department: targetDept,
          metrics: {
            totalSubmissions: 2,
            completedAudits: 2,
            pendingAudits: 0,
            failedAudits: 0,
            averageScore: 76.5,
            passingSubmissions: 1,
            failingSubmissions: 1,
            passRate: 50,
          },
          summary: "Upper Primary ICT department demonstrates strong adherence to Cambridge lower secondary computing frameworks. Year 7 lesson planning features exemplary inquiry and learner attributes, while Year 8 requires scaffolding on relational database queries.",
        },
      };
    }

    if (user.role !== "ADMIN" && (user.role !== "HOD" || user.department !== targetDept)) {
      throw new Error(`Forbidden: You are not authorized to view ${targetDept} department analytics.`);
    }

    let queryRef;
    if (targetDept === "All" || targetDept === "All Departments" || isDivision) {
      queryRef = adminDb.collection("submissions");
    } else {
      queryRef = adminDb.collection("submissions").where("subject", "==", targetDept);
    }
    const snapshot = await queryRef.get();

    let docs = snapshot.docs;
    if (isDivision) {
      const allowedClasses = new Set(DIVISION_CLASSES[targetDept].map((c) => c.toLowerCase()));
      docs = docs.filter((d) => allowedClasses.has((d.data().grade_level || "").trim().toLowerCase()));
    }

    const submissionIds = docs.map((doc) => doc.id);
    const auditMap = await fetchAuditsForSubmissions(submissionIds);

    const submissions = docs.map((doc) => {
      const subData = doc.data() as { status?: string };
      const audit = auditMap[doc.id];
      return {
        id: doc.id,
        ...subData,
        ai_audits: audit ? [audit] : []
      };
    });

    const auditedSubmissions = submissions.filter(
      (sub) => sub.status === "COMPLETED" || sub.status === "RESUBMISSION_REQUIRED"
    );
    const completedAudits = auditedSubmissions
      .map((sub) => sub.ai_audits[0])
      .filter((audit) => audit && audit.score !== null && audit.score !== undefined);

    const totalCount = submissions.length;
    const completedCount = completedAudits.length;
    const pendingCount = submissions.filter((sub) => sub.status === "PENDING" || sub.status === "PROCESSING").length;
    const failedCount = submissions.filter((sub) => sub.status === "FAILED").length;

    let averageScore = 0;
    let underperformingCount = 0;
    const allStrengths: string[] = [];
    const allFlags: string[] = [];

    if (completedCount > 0) {
      const sum = completedAudits.reduce((acc, curr) => acc + Number(curr.score || 0), 0);
      averageScore = Math.round(sum / completedCount);
      underperformingCount = completedAudits.filter((audit) => Number(audit.score || 0) < SCORE_PASSING_THRESHOLD).length;

      completedAudits.forEach((audit) => {
        if (Array.isArray(audit.strengths)) allStrengths.push(...audit.strengths);
        if (Array.isArray(audit.flags)) allFlags.push(...audit.flags);
      });
    }

    let brief = "No department submissions have been successfully audited yet to generate a synthesis.";
    if (completedCount > 0) {
      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: GEMINI_SYNTHESIS_MODEL });

      const synthesisPrompt = `You are a Lead Pedagogical Auditor analyzing weekly lesson plans for the ${targetDept} department.
Here is a summary of the compliance audits for this week:
- Total Lesson Plans Audited: ${completedCount}
- Average Compliance Score: ${averageScore}%
- Underperforming Plans (<${SCORE_PASSING_THRESHOLD}%): ${underperformingCount}
- Total Compliance Flags Raised: ${allFlags.length}
- Sample of strengths noted: ${JSON.stringify(allStrengths.slice(0, 10))}
- Sample of flags raised: ${JSON.stringify(allFlags.slice(0, 10))}

Provide a concise, professional 2-3 sentence executive synthesis for the Head of Department (HOD). Highlight the overall department status, the most common areas of success, and the most critical pedagogical alignment issues they need to address with their teachers. Be direct, constructive, and do not use placeholders.`;

      const result = await model.generateContent(synthesisPrompt);
      brief = result.response.text();
    }

    return {
      success: true,
      stats: {
        totalCount,
        completedCount,
        pendingCount,
        failedCount,
        averageScore,
        underperformingCount,
        commonFlags: Array.from(new Set(allFlags)).slice(0, 5)
      },
      brief
    };
  } catch (err: unknown) {
    logger.error({ err, departmentFilter }, "Failed to generate department analytics");
    return { 
      success: false, 
      error: err instanceof Error ? err.message : "Unknown error",
      stats: {
        totalCount: 0,
        completedCount: 0,
        pendingCount: 0,
        failedCount: 0,
        averageScore: 0,
        underperformingCount: 0,
        commonFlags: []
      },
      brief: "Error generating synthesis. Please try again."
    };
  }
}
