"use server";

import { inngest } from "@/lib/inngest/client";
import { adminDb } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { SCORE_PASSING_THRESHOLD } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { 
  submitLessonPlanSchema, 
  updateSubmissionDecisionSchema, 
  retrySubmissionAuditSchema,
  SubmitLessonPlanInput,
  UpdateSubmissionDecisionInput,
  RetrySubmissionAuditInput
} from "@/lib/schemas/actionSchemas";

interface BatchAuditsMap {
  [submissionId: string]: Record<string, unknown>;
}

/**
 * Helper to fetch all AI audits for a list of submission IDs in batched 'in' queries.
 */
export async function fetchAuditsForSubmissions(submissionIds: string[]): Promise<BatchAuditsMap> {
  const auditMap: BatchAuditsMap = {};
  if (submissionIds.length === 0) return auditMap;

  // Chunk array into slices of 30 (Firestore limit for 'in' queries)
  const chunkSize = 30;
  for (let i = 0; i < submissionIds.length; i += chunkSize) {
    const chunk = submissionIds.slice(i, i + chunkSize);
    const snapshot = await adminDb
      .collection("ai_audits")
      .where("submission_id", "in", chunk)
      .get();

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      auditMap[data.submission_id] = { id: doc.id, ...data };
    });
  }

  return auditMap;
}

export async function submitLessonPlan(rawInput: SubmitLessonPlanInput) {
  try {
    const parsed = submitLessonPlanSchema.safeParse(rawInput);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
      return { success: false, error: `Validation Error: ${errorMsg}` };
    }

    const {
      fileUrl,
      filePath,
      subject,
      weekName,
      gradeLevel,
      teacherId,
      parentSubmissionId,
      version,
      revisionNotes,
    } = parsed.data;

    const user = await getAuthenticatedUser();
    if (user.uid !== teacherId && user.role !== "ADMIN") {
      throw new Error("Forbidden: Cannot submit lesson plans on behalf of another user.");
    }

    let calculatedVersion = version || 1;

    // Handle revision linking if parentSubmissionId is present
    if (parentSubmissionId) {
      const parentDoc = await adminDb.collection("submissions").doc(parentSubmissionId).get();
      if (parentDoc.exists) {
        const parentData = parentDoc.data()!;
        calculatedVersion = (parentData.version || 1) + 1;
      }
    }

    const docRef = await adminDb.collection("submissions").add({
      file_url: fileUrl,
      file_path: filePath || fileUrl,
      subject: subject,
      week_name: weekName,
      teacher_id: teacherId,
      status: "PENDING",
      grade_level: gradeLevel,
      parent_submission_id: parentSubmissionId || null,
      version: calculatedVersion,
      revision_notes: revisionNotes || null,
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
        teacherId,
        version: calculatedVersion,
        parentSubmissionId: parentSubmissionId || null,
      },
    });

    logger.info({ submissionId, teacherId, subject, version: calculatedVersion }, "Lesson plan submitted successfully");
    return { success: true, submissionId, version: calculatedVersion };
  } catch (err: unknown) {
    logger.error({ err, rawInput }, "Submission action failed");
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Fetch all submissions for a teacher from Firestore, including AI audit findings.
 */
export async function getUserSubmissions(teacherId: string) {
  try {
    const user = await getAuthenticatedUser();
    if (user.uid !== teacherId && user.role !== "HOD" && user.role !== "ADMIN") {
      throw new Error("Forbidden: Access to these submissions is restricted.");
    }

    const snapshot = await adminDb
      .collection("submissions")
      .where("teacher_id", "==", teacherId)
      .orderBy("created_at", "desc")
      .limit(100)
      .get();

    const submissionIds = snapshot.docs.map((doc) => doc.id);
    const auditMap = await fetchAuditsForSubmissions(submissionIds);

    const submissions = snapshot.docs.map((doc) => {
      const subData = { id: doc.id, ...doc.data() };
      const audit = auditMap[doc.id];
      return {
        ...subData,
        ai_audits: audit ? [audit] : []
      };
    });

    return { success: true, data: submissions };
  } catch (err: unknown) {
    logger.error({ err, teacherId }, "Failed to get submissions");
    return { success: false, error: err instanceof Error ? err.message : "Unknown error", data: [] };
  }
}

/**
 * Fetch a single submission's status and AI audit details.
 */
export async function getSubmissionStatus(submissionId: string) {
  try {
    const user = await getAuthenticatedUser();
    const doc = await adminDb.collection("submissions").doc(submissionId).get();
    if (!doc.exists) {
      throw new Error("Submission not found.");
    }

    const subData = doc.data()!;
    if (subData.teacher_id !== user.uid && user.department !== subData.subject && user.role !== "ADMIN") {
      throw new Error("Forbidden: You do not have access to this submission.");
    }

    const auditSnapshot = await adminDb
      .collection("ai_audits")
      .where("submission_id", "==", submissionId)
      .limit(1)
      .get();

    const ai_audits = auditSnapshot.empty 
      ? [] 
      : [ { id: auditSnapshot.docs[0].id, ...auditSnapshot.docs[0].data() } ];

    return { success: true, data: { id: doc.id, ...subData, ai_audits } };
  } catch (err: unknown) {
    logger.error({ err, submissionId }, "Failed to check submission status");
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Fetch all submissions for a specific department (for HOD view).
 */
export async function getDepartmentSubmissions(department: string) {
  try {
    const user = await getAuthenticatedUser();
    if (user.role !== "ADMIN" && (user.role !== "HOD" || user.department !== department)) {
      throw new Error(`Forbidden: You are not authorized to view ${department} department submissions.`);
    }

    let queryRef;
    if (department === "All" || department === "All Departments") {
      queryRef = adminDb.collection("submissions").orderBy("created_at", "desc").limit(100);
    } else {
      queryRef = adminDb.collection("submissions").where("subject", "==", department).orderBy("created_at", "desc").limit(100);
    }
    const snapshot = await queryRef.get();

    const submissionIds = snapshot.docs.map((doc) => doc.id);
    const auditMap = await fetchAuditsForSubmissions(submissionIds);

    const teacherIds = Array.from(new Set(snapshot.docs.map((doc) => doc.data().teacher_id).filter(Boolean)));
    const profilesMap: Record<string, { full_name?: string; department?: string }> = {};

    const profileDocs = await Promise.all(
      teacherIds.map((tId) => adminDb.collection("profiles").doc(tId).get())
    );

    profileDocs.forEach((pDoc, idx) => {
      if (pDoc.exists) {
        profilesMap[teacherIds[idx]] = pDoc.data() as { full_name?: string; department?: string };
      }
    });

    const submissions = snapshot.docs.map((doc) => {
      const data = doc.data();
      const subData = { id: doc.id, ...data };
      const audit = auditMap[doc.id];
      const profile = profilesMap[data.teacher_id] || { full_name: "Teacher", department: data.subject };
      return {
        ...subData,
        profiles: profile,
        ai_audits: audit ? [audit] : []
      };
    });

    return { success: true, data: submissions };
  } catch (err: unknown) {
    logger.error({ err, department }, "Failed to get department submissions");
    return { success: false, error: err instanceof Error ? err.message : "Unknown error", data: [] };
  }
}

/**
 * Allows HODs and Admins to approve, request revisions, or mark submissions for peer observation.
 */
export async function updateSubmissionDecision(rawInput: UpdateSubmissionDecisionInput) {
  try {
    const parsed = updateSubmissionDecisionSchema.safeParse(rawInput);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
      return { success: false, error: `Validation Error: ${errorMsg}` };
    }

    const { submissionId, decision, comments } = parsed.data;

    const user = await getAuthenticatedUser();
    const doc = await adminDb.collection("submissions").doc(submissionId).get();
    if (!doc.exists) {
      throw new Error("Submission not found.");
    }
    const subData = doc.data()!;

    if (user.role !== "ADMIN" && (user.role !== "HOD" || user.department !== subData.subject)) {
      throw new Error("Forbidden: Only assigned HODs can update submission decisions.");
    }

    // Enforce threshold sign-off gate: Cannot approve if score < 70% or requires resubmission
    if (decision === "APPROVED") {
      if (subData.requires_resubmission || subData.status === "RESUBMISSION_REQUIRED") {
        throw new Error(`Sign-off Blocked: This lesson plan scored below the mandatory ${SCORE_PASSING_THRESHOLD}% threshold. A revised plan must be submitted before approval.`);
      }

      // Also verify latest audit score directly
      const auditSnapshot = await adminDb
        .collection("ai_audits")
        .where("submission_id", "==", submissionId)
        .limit(1)
        .get();

      if (!auditSnapshot.empty) {
        const auditData = auditSnapshot.docs[0].data();
        if (typeof auditData.score === "number" && auditData.score < SCORE_PASSING_THRESHOLD) {
          throw new Error(`Sign-off Blocked: Lesson plan compliance score (${auditData.score}%) is below the mandatory ${SCORE_PASSING_THRESHOLD}% threshold.`);
        }
      }
    }

    await adminDb.collection("submissions").doc(submissionId).update({
      hod_decision: decision,
      hod_feedback: comments || "",
      hod_updated_at: new Date(),
      hod_updated_by: user.full_name || user.uid
    });

    logger.info({ submissionId, decision, updatedBy: user.uid }, "Updated HOD decision on submission");
    return { success: true };
  } catch (err: unknown) {
    logger.error({ err, rawInput }, "Failed to update HOD decision");
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Allows re-triggering the background audit for a failed submission.
 */
export async function retrySubmissionAudit(rawInput: RetrySubmissionAuditInput) {
  try {
    const parsed = retrySubmissionAuditSchema.safeParse(rawInput);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
      return { success: false, error: `Validation Error: ${errorMsg}` };
    }

    const { submissionId } = parsed.data;

    const user = await getAuthenticatedUser();
    const doc = await adminDb.collection("submissions").doc(submissionId).get();
    if (!doc.exists) {
      throw new Error("Submission not found.");
    }
    const subData = doc.data()!;
    if (subData.teacher_id !== user.uid && user.role !== "HOD" && user.role !== "ADMIN") {
      throw new Error("Forbidden: You cannot retry this submission.");
    }

    await adminDb.collection("submissions").doc(submissionId).update({
      status: "PENDING",
      error_message: null
    });

    await inngest.send({
      name: "lesson_plan.uploaded",
      data: {
        submissionId,
        fileUrl: subData.file_url,
        filePath: subData.file_path || subData.file_url,
        subject: subData.subject,
        weekName: subData.week_name,
        gradeLevel: subData.grade_level,
        teacherId: subData.teacher_id,
        version: subData.version || 1,
        parentSubmissionId: subData.parent_submission_id || null,
      },
    });

    logger.info({ submissionId }, "Retried submission audit");
    return { success: true };
  } catch (err: unknown) {
    logger.error({ err, rawInput }, "Failed to retry submission audit");
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
