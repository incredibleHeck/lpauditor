"use server";

import { inngest } from "@/lib/inngest/client";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createClient } from "@/lib/server";

export async function submitLessonPlan({
  fileUrl,
  subject,
  weekName,
}: {
  fileUrl: string;
  subject: string;
  weekName: string;
}) {
  try {
    // 1. Get the authenticated user dynamically from session
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    // Fallback to Hector Aryiku's hardcoded ID in development/mock situations
    const teacherId = user?.id || '025c5bfd-3c0c-44e9-ab43-def912de64c2';

    const { data, error } = await supabaseAdmin
      .from('submissions')
      .insert({
        file_url: fileUrl,
        subject: subject,
        week_name: weekName,
        teacher_id: teacherId,
        status: 'PENDING',
        grade_level: 'Grade 1' // Default for now
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
