"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileText, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { submitLessonPlan } from "@/app/actions/submissions";

export default function LessonPlanDropzone() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const selectedFile = acceptedFiles[0];
    setFile(selectedFile);
    setUploadState("uploading");
    setErrorMessage("");

    try {
      // 1. Sanitize the filename to prevent URL errors
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      // 2. Direct Storage Upload to Supabase
      const { data: storageData, error: storageError } = await supabase.storage
        .from('lesson-plans')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (storageError) throw storageError;

      // 3. Database Logging & Inngest Trigger
      // We pass the public URL or the path. For now, we'll pass the path.
      const { success, error: actionError } = await submitLessonPlan({
        fileUrl: storageData.path,
        subject: "Primary Science", // Placeholder as per instructions
        weekName: "Week 1",         // Placeholder as per instructions
      });

      if (!success) throw new Error(actionError);

      console.log("File uploaded and submission logged successfully.");
      setUploadState("success");

    } catch (error: any) {
      console.error("Process failed:", error.message);
      setUploadState("error");
      setErrorMessage(error.message || "Failed to process lesson plan. Please try again.");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
    disabled: uploadState === "uploading" || uploadState === "success"
  });

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition ${
          uploadState === "uploading" || uploadState === "success" 
            ? "cursor-default opacity-75" 
            : "cursor-pointer"
        } ${
          isDragActive
            ? "border-amber-500 bg-amber-50/50"
            : "border-slate-300 bg-slate-50 hover:bg-slate-100"
        } ${uploadState === "error" ? "border-red-500 bg-red-50" : ""}`}
      >
        <input {...getInputProps()} />
        
        {uploadState === "idle" && (
          <>
            <UploadCloud className="mx-auto h-12 w-12 text-slate-400 mb-3" />
            {isDragActive ? (
              <p className="text-sm font-medium text-amber-600">Drop the lesson plan here...</p>
            ) : (
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Drag and drop your lesson plan here, or click to browse
                </p>
                <p className="text-xs text-slate-400 mt-1">Supports Cambridge formats (.docx or .pdf)</p>
              </div>
            )}
          </>
        )}

        {uploadState === "uploading" && (
          <div className="flex flex-col items-center justify-center py-4">
            <Loader2 className="h-10 w-10 text-amber-500 animate-spin mb-3" />
            <p className="text-sm font-medium text-slate-700">Encrypting & Uploading to Vault...</p>
          </div>
        )}

        {uploadState === "success" && (
          <div className="flex flex-col items-center justify-center py-4">
            <CheckCircle className="h-10 w-10 text-green-500 mb-3" />
            <p className="text-sm font-medium text-green-700">Upload Complete</p>
          </div>
        )}
      </div>

      {file && uploadState !== "idle" && (
        <div className="mt-4 p-3 bg-slate-100 rounded-lg flex items-center justify-between border border-slate-200">
          <div className="flex items-center gap-2 overflow-hidden">
            <FileText className="text-amber-600 h-5 w-5 shrink-0" />
            <span className="text-sm font-medium text-slate-700 truncate">
              {file.name}
            </span>
          </div>
          {uploadState === "error" && (
             <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 bg-red-100 text-red-800 rounded">
               <AlertCircle size={14} /> Failed
             </span>
          )}
          {uploadState === "success" && (
            <span className="text-xs font-semibold px-2 py-1 bg-green-100 text-green-800 rounded">
              Ready for Audit
            </span>
          )}
        </div>
      )}

      {errorMessage && (
        <p className="mt-2 text-sm text-red-600 font-medium text-center">{errorMessage}</p>
      )}
    </div>
  );
}
