"use server";

import { inngest } from "@/lib/inngest/client";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createClient } from "@/lib/server";

export async function submitLessonPlan({
  fileUrl,
  subject,
  weekName,
  gradeLevel,
}: {
  fileUrl: string;
  subject: string;
  weekName: string;
  gradeLevel: string;
}) {
  try {
    // 1. Get the authenticated user dynamically from session
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error("Unauthorized: You must be logged in to submit a lesson plan.");
    }

    const teacherId = user.id;

    const { data, error } = await supabaseAdmin
      .from('submissions')
      .insert({
        file_url: fileUrl,
        subject: subject,
        week_name: weekName,
        teacher_id: teacherId,
        status: 'PENDING',
        grade_level: gradeLevel
      })
      .select()
      .single();

    if (error) {
      console.error("Database insert error:", error);
      return { success: false, error: error.message };
    }

    // 2. Trigger Inngest Event
    await inngest.send({
      name: "lesson_plan.uploaded",
      data: {
        submissionId: data.id,
        fileUrl: data.file_url,
        subject: data.subject,
        weekName: data.week_name,
        gradeLevel: data.grade_level,
      },
    });

    return { success: true, submissionId: data.id };
  } catch (err: any) {
    console.error("Submission action failed:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch all submissions for a teacher, including their AI audit findings.
 */
export async function getUserSubmissions(teacherId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('submissions')
      .select('*, ai_audits(*)')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (err: any) {
    console.error("Failed to get submissions:", err);
    return { success: false, error: err.message, data: [] };
  }
}

/**
 * Fetch a single submission's status and AI audit details.
 * Used for dynamic frontend polling.
 */
export async function getSubmissionStatus(submissionId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('submissions')
      .select('*, ai_audits(*)')
      .eq('id', submissionId)
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (err: any) {
    console.error("Failed to check submission status:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch all submissions for a specific department (for HOD view).
 */
export async function getDepartmentSubmissions(department: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('submissions')
      .select('*, ai_audits(*), profiles!inner(full_name, department)')
      .eq('profiles.department', department)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (err: any) {
    console.error("Failed to get department submissions:", err);
    return { success: false, error: err.message, data: [] };
  }
}

