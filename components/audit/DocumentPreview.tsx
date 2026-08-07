import React from "react";
import { ExternalLink, FileText } from "lucide-react";

interface DocumentPreviewProps {
  fileName: string;
  fileUrl: string | undefined;
  isPdf: boolean;
}

export default function DocumentPreview({ fileName, fileUrl, isPdf }: DocumentPreviewProps) {
  if (!fileUrl) return null;

  return (
    <div className="w-1/2 border-r border-zinc-200 bg-zinc-900 flex flex-col">
      <div className="px-4 py-2 bg-zinc-950 border-b border-zinc-800 flex justify-between items-center text-xs text-zinc-400">
        <span className="font-semibold truncate max-w-[240px]">{fileName}</span>
        <a 
          href={fileUrl} 
          target="_blank" 
          rel="noreferrer"
          className="flex items-center gap-1 text-amber-400 hover:underline font-bold"
        >
          Open in New Tab <ExternalLink size={12} />
        </a>
      </div>
      <div className="flex-1 bg-zinc-800 overflow-hidden flex items-center justify-center">
        {isPdf ? (
          <iframe 
            src={fileUrl ? (fileUrl.includes('#') ? fileUrl : `${fileUrl}#toolbar=0`) : ""} 
            className="w-full h-full border-0" 
            title="Lesson Plan Document Preview"
          />
        ) : (
          <div className="p-8 text-center text-zinc-300 space-y-4 max-w-sm">
            <FileText className="mx-auto h-16 w-16 text-zinc-500" />
            <p className="text-sm font-semibold">Word Document (.docx) Preview</p>
            <p className="text-xs text-zinc-400">
              Browser iframe preview is optimized for PDF documents. Click below to view or download the uploaded lesson plan file.
            </p>
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs rounded-xl transition-all shadow-sm"
            >
              Download / Open File <ExternalLink size={14} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
