"use server";

import { inngest } from "@/lib/inngest/client";
import { adminDb } from "@/lib/firebase-admin";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import { SCORE_PASSING_THRESHOLD, DIVISION_CLASSES } from "@/lib/constants";
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

// In-Memory Store for Local Sandbox Testing
const INITIAL_DEMO_SUBMISSIONS: any[] = [
  {
    id: "sub-ict-demo-1",
    file_url: "https://stadelaideschool.com/curriculum/Year_7_ICT_Algorithms_Flowcharts_Week1.docx",
    file_path: "lesson-plans/demo-teacher-ict/Year_7_ICT_Algorithms_Flowcharts_Week1.docx",
    subject: "ICT",
    week_name: "Week 1",
    grade_level: "Year 7 (Streams A & B)",
    status: "COMPLETED",
    hod_decision: "APPROVED",
    hod_feedback: "Exemplary plan. SMART verbs well-aligned to Cambridge lower secondary computing framework.",
    teacher_id: "demo-teacher-ict",
    profiles: {
      full_name: "Mr. Derrick Thompson",
      department: "ICT",
    },
    version: 1,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    ai_audits: [
      {
        id: "audit-ict-1",
        submission_id: "sub-ict-demo-1",
        score: 88,
        lesson_plan_count: 2,
        rubric_type: "CAMBRIDGE",
        time_compliance: {
          is_compliant: true,
          total_allocated_minutes: 90,
          pacing_feedback: "Timing is well-structured: 15 min Starter (logic puzzle), 55 min Main (algorithm design & testing), 20 min Plenary recap.",
        },
        age_appropriateness: {
          score: 92,
          feedback: "Concepts of sequential logic and decision branching are well-matched to Year 7 cognitive development.",
        },
        instructional_delivery: {
          teacher_student_ratio: "30/70 Student-Centered",
          methodology_notes: "Guided inquiry followed by hands-on pair programming.",
          step_by_step_tips: [
            "Start with physical unplugged algorithm demonstration.",
            "Use flow-chart symbol cards before screen-based work.",
            "Challenge advanced students with nested condition loops."
          ],
        },
        learner_attributes: {
          confident: 85,
          responsible: 90,
          reflective: 88,
          innovative: 92,
          engaged: 89,
        },
        exam_command_verbs: ["Construct", "Trace", "Analyze", "Evaluate"],
        cognitive_demand: {
          low_recall: 20,
          medium_application: 50,
          high_evaluation: 30,
        },
        strengths: [
          "Outstanding scaffolding for beginner coders using Cambridge visual syntax.",
          "Clear assessment rubrics with success criteria for Foundation, Core, and Extension tiers."
        ],
        flags: [],
      },
    ],
  },
  {
    id: "sub-ict-demo-2",
    file_url: "https://stadelaideschool.com/curriculum/Year_8_ICT_Database_Queries_Week2.docx",
    file_path: "lesson-plans/demo-teacher-ict/Year_8_ICT_Database_Queries_Week2.docx",
    subject: "ICT",
    week_name: "Week 2",
    grade_level: "Year 8",
    status: "COMPLETED",
    hod_decision: "REVISION_REQUESTED",
    hod_feedback: "Please add explicit scaffolding for Foundation students on SQL SELECT query syntax before moving to multi-table joins.",
    teacher_id: "demo-teacher-ict",
    profiles: {
      full_name: "Mr. Derrick Thompson",
      department: "ICT",
    },
    version: 1,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    ai_audits: [
      {
        id: "audit-ict-2",
        submission_id: "sub-ict-demo-2",
        score: 65,
        lesson_plan_count: 2,
        rubric_type: "CAMBRIDGE",
        time_compliance: {
          is_compliant: true,
          total_allocated_minutes: 80,
          pacing_feedback: "Starter takes 10 mins, Main takes 60 mins, Plenary 10 mins.",
        },
        age_appropriateness: {
          score: 80,
          feedback: "Relational database concepts are suitable for Year 8.",
        },
        instructional_delivery: {
          teacher_student_ratio: "50/50",
          methodology_notes: "Teacher-led syntax demonstration followed by workstation tasks.",
          step_by_step_tips: [
            "Provide pre-populated database schemas to avoid data-entry fatigue.",
            "Scaffold SQL commands with syntax coloring."
          ],
        },
        learner_attributes: {
          confident: 65,
          responsible: 70,
          reflective: 60,
          innovative: 65,
          engaged: 70,
        },
        exam_command_verbs: ["Identify", "Execute", "Modify"],
        cognitive_demand: {
          low_recall: 35,
          medium_application: 50,
          high_evaluation: 15,
        },
        strengths: [
          "Practical real-world scenario (School Library Database).",
          "Clear database design schema included."
        ],
        flags: [
          "Score 65% is below the mandatory 70% threshold.",
          "Differentiation section lacks explicit Foundation tier modifications."
        ],
      },
    ],
  },
];

const demoSubmissionsStore = [...INITIAL_DEMO_SUBMISSIONS];

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

    // Sandbox Local Demo Handling
    if (teacherId.startsWith("demo-") || user.uid.startsWith("demo-")) {
      if (parentSubmissionId) {
        const parent = demoSubmissionsStore.find((s) => s.id === parentSubmissionId);
        if (parent) {
          calculatedVersion = (parent.version || 1) + 1;
        }
      }

      const newSubId = `sub-ict-demo-${Date.now()}`;
      const newSubmission = {
        id: newSubId,
        file_url: fileUrl,
        file_path: filePath || fileUrl,
        subject,
        week_name: weekName,
        teacher_id: teacherId,
        status: "COMPLETED",
        grade_level: gradeLevel,
        parent_submission_id: parentSubmissionId || null,
        version: calculatedVersion,
        revision_notes: revisionNotes || null,
        created_at: new Date().toISOString(),
        profiles: {
          full_name: user.full_name || "Mr. Derrick Thompson",
          department: user.department || "ICT",
        },
        ai_audits: [
          {
            id: `audit-${newSubId}`,
            submission_id: newSubId,
            score: 87,
            lesson_plan_count: 2,
            rubric_type: "CAMBRIDGE",
            time_compliance: {
              is_compliant: true,
              total_allocated_minutes: 90,
              pacing_feedback: "Effective pacing across Starter, Main activity, and Plenary recap.",
            },
            age_appropriateness: {
              score: 91,
              feedback: `Content and cognitive load are appropriate for ${gradeLevel}.`,
            },
            instructional_delivery: {
              teacher_student_ratio: "30/70 Student-Centered",
              methodology_notes: "Guided inquiry followed by hands-on pair activities.",
              step_by_step_tips: [
                "Establish explicit success criteria with Cambridge rubrics.",
                "Ensure differentiated Extension tasks are ready for rapid finishers."
              ],
            },
            learner_attributes: {
              confident: 88,
              responsible: 90,
              reflective: 85,
              innovative: 89,
              engaged: 92,
            },
            exam_command_verbs: ["Formulate", "Investigate", "Evaluate", "Demonstrate"],
            cognitive_demand: {
              low_recall: 20,
              medium_application: 50,
              high_evaluation: 30,
            },
            strengths: [
              "Well-structured objectives aligning with Cambridge learning frameworks.",
              "Comprehensive assessment rubrics across learning tiers."
            ],
            flags: [],
          },
        ],
      };

      demoSubmissionsStore.unshift(newSubmission);
      return { success: true, submissionId: newSubId, version: calculatedVersion };
    }

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

    // Sandbox Local Demo Handling
    if (teacherId.startsWith("demo-")) {
      const filtered = demoSubmissionsStore.filter((s) => s.teacher_id === teacherId);
      return { success: true, data: filtered };
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

    // Sandbox Local Demo Handling
    if (submissionId.startsWith("sub-ict-demo")) {
      const demoSub = demoSubmissionsStore.find((s) => s.id === submissionId);
      if (demoSub) {
        return { success: true, data: demoSub };
      }
    }

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
    const isDivision = Boolean(DIVISION_CLASSES[department]);

    // Sandbox Local Demo Handling
    if (user.uid.startsWith("demo-")) {
      return { success: true, data: demoSubmissionsStore };
    }

    if (user.role !== "ADMIN" && (user.role !== "HOD" || user.department !== department)) {
      throw new Error(`Forbidden: You are not authorized to view ${department} department submissions.`);
    }

    let queryRef;
    if (department === "All" || department === "All Departments" || isDivision) {
      queryRef = adminDb.collection("submissions").orderBy("created_at", "desc").limit(100);
    } else {
      queryRef = adminDb.collection("submissions").where("subject", "==", department).orderBy("created_at", "desc").limit(100);
    }
    const snapshot = await queryRef.get();

    let docs = snapshot.docs;
    if (isDivision) {
      const allowedClasses = new Set(DIVISION_CLASSES[department].map((c) => c.toLowerCase()));
      docs = docs.filter((d) => allowedClasses.has((d.data().grade_level || "").trim().toLowerCase()));
    }

    const submissionIds = docs.map((doc) => doc.id);
    const auditMap = await fetchAuditsForSubmissions(submissionIds);

    const teacherIds = Array.from(new Set(docs.map((doc) => doc.data().teacher_id).filter(Boolean)));
    const profilesMap: Record<string, { full_name?: string; department?: string }> = {};

    const profileDocs = await Promise.all(
      teacherIds.map((tId) => adminDb.collection("profiles").doc(tId).get())
    );

    profileDocs.forEach((pDoc, idx) => {
      if (pDoc.exists) {
        profilesMap[teacherIds[idx]] = pDoc.data() as { full_name?: string; department?: string };
      }
    });

    const submissions = docs.map((doc) => {
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

    // Sandbox Local Demo Handling
    if (submissionId.startsWith("sub-ict-demo")) {
      const demoSub = demoSubmissionsStore.find((s) => s.id === submissionId);
      if (demoSub) {
        if (decision === "APPROVED") {
          const score = demoSub.ai_audits?.[0]?.score || 0;
          if (score < SCORE_PASSING_THRESHOLD) {
            throw new Error(`Sign-off Blocked: This lesson plan scored below the mandatory ${SCORE_PASSING_THRESHOLD}% threshold. A revised plan must be submitted before approval.`);
          }
        }
        demoSub.hod_decision = decision;
        demoSub.hod_feedback = comments || null;
        return { success: true };
      }
    }

    const doc = await adminDb.collection("submissions").doc(submissionId).get();
    if (!doc.exists) {
      throw new Error("Submission not found.");
    }
    const subData = doc.data()!;

    // Check sectional / divisional HOD authorization or subject fallback
    const userDivisionClasses = user.department && DIVISION_CLASSES[user.department]
      ? DIVISION_CLASSES[user.department].map((c) => c.toLowerCase())
      : null;

    const isClassInDivision = userDivisionClasses
      ? userDivisionClasses.includes((subData.grade_level || "").toLowerCase())
      : false;

    const isAuthorizedHOD =
      user.role === "HOD" && (isClassInDivision || user.department === subData.subject);

    if (user.role !== "ADMIN" && !isAuthorizedHOD) {
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
