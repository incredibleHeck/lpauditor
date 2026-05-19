"use server";

import { inngest } from "@/lib/inngest/client";
import { supabaseAdmin } from "@/lib/supabase-admin";

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
    // 1. Insert into PostgreSQL via Supabase Admin
    // Using the real teacher_id for Hector Aryiku
    const teacherId = '025c5bfd-3c0c-44e9-ab43-def912de64c2';

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
