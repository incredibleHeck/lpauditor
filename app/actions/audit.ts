"use server";

import { inngest } from "@/lib/inngest";
import { supabase } from "@/lib/supabase";

export async function triggerAudit({ 
  submissionId, 
  uri, 
  rubric 
}: { 
  submissionId: string; 
  uri: string; 
  rubric: string; 
}) {
  await inngest.send({
    name: "lesson_plan.uploaded",
    data: {
      submissionId,
      uri,
      rubric,
    },
  });

  return { success: true };
}

export async function createSubmission({
  userId,
  subjectId,
  gcsUri
}: {
  userId: string;
  subjectId: string;
  gcsUri: string;
}) {
  const { data, error } = await supabase
    .from("submissions")
    .insert({
      user_id: userId,
      subject_id: subjectId,
      gcs_uri: gcsUri,
      status: "PENDING"
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
