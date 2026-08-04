"use server";

import { inngest } from "@/lib/inngest/client";
import { adminDb } from "@/lib/firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function submitLessonPlan({
  fileUrl,
  filePath,
  subject,
  weekName,
  gradeLevel,
  teacherId,
}: {
  fileUrl: string;
  filePath?: string;
  subject: string;
  weekName: string;
  gradeLevel: string;
  teacherId: string;
}) {
  try {
    if (!teacherId) {
      throw new Error("Unauthorized: You must be logged in to submit a lesson plan.");
    }

    const docRef = await adminDb.collection("submissions").add({
      file_url: fileUrl,
      file_path: filePath || fileUrl,
      subject: subject,
      week_name: weekName,
      teacher_id: teacherId,
      status: "PENDING",
      grade_level: gradeLevel,
      created_at: new Date()
    });

    const submissionId = docRef.id;

    await inngest.send({
      name: "lesson_plan.uploaded",
      data: {
        submissionId,
        fileUrl,
        filePath: filePath || fileUrl,
        subject,
        weekName,
        gradeLevel,
      },
    });

    return { success: true, submissionId };
  } catch (err: unknown) {
    console.error("Submission action failed:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Fetch all submissions for a teacher from Firestore, including AI audit findings.
 */
export async function getUserSubmissions(teacherId: string) {
  try {
    if (!teacherId) {
      throw new Error("Unauthorized: Access denied.");
    }

    const snapshot = await adminDb
      .collection("submissions")
      .where("teacher_id", "==", teacherId)
      .orderBy("created_at", "desc")
      .get();

    const submissions = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const subData = { id: doc.id, ...doc.data() };
        const auditSnapshot = await adminDb
          .collection("ai_audits")
          .where("submission_id", "==", doc.id)
          .limit(1)
          .get();

        const ai_audits = auditSnapshot.empty 
          ? [] 
          : [ { id: auditSnapshot.docs[0].id, ...auditSnapshot.docs[0].data() } ];

        return { ...subData, ai_audits };
      })
    );

    return { success: true, data: submissions };
  } catch (err: unknown) {
    console.error("Failed to get submissions:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error", data: [] };
  }
}

/**
 * Fetch a single submission's status and AI audit details.
 */
export async function getSubmissionStatus(submissionId: string) {
  try {
    const doc = await adminDb.collection("submissions").doc(submissionId).get();
    if (!doc.exists) {
      throw new Error("Submission not found.");
    }

    const subData = { id: doc.id, ...doc.data() };

    const auditSnapshot = await adminDb
      .collection("ai_audits")
      .where("submission_id", "==", submissionId)
      .limit(1)
      .get();

    const ai_audits = auditSnapshot.empty 
      ? [] 
      : [ { id: auditSnapshot.docs[0].id, ...auditSnapshot.docs[0].data() } ];

    return { success: true, data: { ...subData, ai_audits } };
  } catch (err: unknown) {
    console.error("Failed to check submission status:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Fetch all submissions for a specific department (for HOD view).
 */
export async function getDepartmentSubmissions(department: string) {
  try {
    const snapshot = await adminDb
      .collection("submissions")
      .where("subject", "==", department)
      .orderBy("created_at", "desc")
      .get();

    const submissions = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const subData = { id: doc.id, ...doc.data() };
        
        const auditSnapshot = await adminDb
          .collection("ai_audits")
          .where("submission_id", "==", doc.id)
          .limit(1)
          .get();

        const ai_audits = auditSnapshot.empty 
          ? [] 
          : [ { id: auditSnapshot.docs[0].id, ...auditSnapshot.docs[0].data() } ];

        return { ...subData, ai_audits };
      })
    );

    return { success: true, data: submissions };
  } catch (err: unknown) {
    console.error("Failed to get department submissions:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error", data: [] };
  }
}

/**
 * Handle multi-turn pedagogical chat with Gemini 3.6 Flash using audit findings.
 */
export async function chatWithAuditor(
  submissionId: string,
  history: { role: "user" | "model"; text: string }[],
  userMessage: string
) {
  try {
    const doc = await adminDb.collection("submissions").doc(submissionId).get();
    if (!doc.exists) {
      throw new Error("Submission not found.");
    }
    const submission = doc.data()!;

    const auditSnapshot = await adminDb
      .collection("ai_audits")
      .where("submission_id", "==", submissionId)
      .limit(1)
      .get();

    if (auditSnapshot.empty) {
      throw new Error("No audit report found for this submission yet.");
    }

    const audit = auditSnapshot.docs[0].data();

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
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
      model: "gemini-3.6-flash",
      systemInstruction,
    });

    const chatHistory = history.map((h) => ({
      role: h.role === "model" ? "model" : "user",
      parts: [{ text: h.text }],
    }));

    const chat = model.startChat({
      history: chatHistory,
    });

    const result = await chat.sendMessage(userMessage);
    const reply = result.response.text();

    return { success: true, reply };
  } catch (err: unknown) {
    console.error("Chat with auditor action failed:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Generates statistics and a weekly brief/synthesis for HOD view using Gemini 3.6 Flash.
 */
export async function getDepartmentAnalytics(department: string) {
  try {
    const snapshot = await adminDb
      .collection("submissions")
      .where("subject", "==", department)
      .get();

    const submissions: any[] = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const subData = { id: doc.id, ...doc.data() };
        const auditSnapshot = await adminDb
          .collection("ai_audits")
          .where("submission_id", "==", doc.id)
          .limit(1)
          .get();

        const ai_audits = auditSnapshot.empty ? [] : [auditSnapshot.docs[0].data()];
        return { ...subData, ai_audits };
      })
    );

    const completedSubmissions = submissions.filter((sub) => sub.status === "COMPLETED");
    const completedAudits = completedSubmissions
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
      underperformingCount = completedAudits.filter((audit) => Number(audit.score || 0) < 50).length;

      completedAudits.forEach((audit) => {
        if (Array.isArray(audit.strengths)) allStrengths.push(...audit.strengths);
        if (Array.isArray(audit.flags)) allFlags.push(...audit.flags);
      });
    }

    let brief = "No department submissions have been successfully audited yet to generate a synthesis.";
    if (completedCount > 0) {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

      const synthesisPrompt = `You are a Lead Pedagogical Auditor analyzing weekly lesson plans for the ${department} department.
Here is a summary of the compliance audits for this week:
- Total Completed Lesson Plans Audited: ${completedCount}
- Average Compliance Score: ${averageScore}%
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
    console.error("Failed to generate department analytics:", err);
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
