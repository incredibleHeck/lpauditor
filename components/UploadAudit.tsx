"use client";

import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/lib/supabase";
import { createSubmission, triggerAudit } from "@/app/actions/audit";
import { Button } from "@/components/ui/button";

export function UploadAudit() {
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsUploading(true);
    setStatus("Uploading to Supabase...");

    try {
      // 1. Upload to Supabase Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `submissions/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("submissions")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const publicUrl = supabase.storage.from("submissions").getPublicUrl(filePath).data.publicUrl;

      // 2. Create DB Record
      setStatus("Creating database record...");
      // For demo, we use a dummy user ID if not logged in
      const submission = await createSubmission({
        userId: "d3b07384-d92e-443b-9a7d-1c3f71c3a647", // Replace with real auth UID
        subjectId: "Cambridge-Maths-01",
        gcsUri: publicUrl,
      });

      // 3. Trigger Inngest Audit
      setStatus("Triggering AI Audit...");
      await triggerAudit({
        submissionId: submission.id,
        uri: publicUrl,
        rubric: "Cambridge International Standard for Lesson Planning v2.1",
      });

      setStatus("Audit process started! Check dashboard for results.");
    } catch (error: any) {
      console.error(error);
      setStatus(`Error: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles: 1
  });

  return (
    <div className="w-full max-w-md p-6 bg-white rounded-xl shadow-md border border-zinc-200">
      <div 
        {...getRootProps()} 
        className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
          isDragActive ? "border-blue-500 bg-blue-50" : "border-zinc-300 hover:border-zinc-400"
        }`}
      >
        <input {...getInputProps()} />
        {isUploading ? (
          <p className="text-zinc-600 animate-pulse">Processing...</p>
        ) : isDragActive ? (
          <p className="text-blue-500 font-medium">Drop the file here...</p>
        ) : (
          <div>
            <p className="text-zinc-600">Drag & drop a lesson plan (PDF/DOCX)</p>
            <p className="text-xs text-zinc-400 mt-2">Maximum file size: 10MB</p>
          </div>
        )}
      </div>
      
      {status && (
        <div className="mt-4 p-3 bg-zinc-50 rounded text-sm text-zinc-700">
          {status}
        </div>
      )}

      <Button 
        className="w-full mt-4" 
        disabled={isUploading}
        variant="outline"
      >
        Browse Files
      </Button>
    </div>
  );
}
