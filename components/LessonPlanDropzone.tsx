"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileText, CheckCircle, AlertCircle } from "lucide-react";

export default function LessonPlanDropzone() {
  const [file, setFile] = useState<File | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      console.log("Selected file:", acceptedFiles[0].name);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
  });

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
          isDragActive
            ? "border-amber-500 bg-amber-50/50"
            : "border-slate-300 bg-slate-50 hover:bg-slate-100"
        }`}
      >
        <input {...getInputProps()} />
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
      </div>

      {file && (
        <div className="mt-4 p-3 bg-slate-100 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="text-amber-600 h-5 w-5" />
            <span className="text-sm font-medium text-slate-700 truncate max-w-xs">
              {file.name}
            </span>
          </div>
          <span className="text-xs font-semibold px-2 py-1 bg-green-100 text-green-800 rounded">
            Ready to Upload
          </span>
        </div>
      )}
    </div>
  );
}
