"use client";

import React, { useState, useEffect } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

interface DocumentPreviewProps {
  fileName: string;
  fileUrl: string | undefined;
  isPdf: boolean;
  flags?: string[];
}

export default function DocumentPreview({ fileName, fileUrl, isPdf, flags = [] }: DocumentPreviewProps) {
  const [numPages, setNumPages] = useState<number>();

  useEffect(() => {
    if (typeof window !== "undefined") {
      pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    }
  }, []);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
    setNumPages(numPages);
  }

  if (!fileUrl) return null;

  return (
    <div className="w-1/2 border-r border-slate-200 bg-slate-50 flex flex-col font-sans">
      <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex justify-between items-center text-xs text-slate-600">
        <span className="font-semibold text-slate-800 truncate max-w-[220px]">{fileName}</span>
        <a 
          href={fileUrl} 
          target="_blank" 
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-slate-900 hover:text-slate-700 font-semibold underline underline-offset-2 cursor-pointer"
        >
          <span>Open Document</span>
          <ExternalLink size={12} />
        </a>
      </div>
      <div className="flex-1 bg-slate-100/70 overflow-y-auto flex flex-col items-center justify-start py-5 px-3 relative">
        {isPdf ? (
          <div className="flex flex-col items-center w-full relative">
            <Document 
              file={fileUrl} 
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<div className="text-slate-400 text-xs mt-10">Loading PDF document preview…</div>}
              className="flex flex-col items-center"
            >
              {numPages && Array.from(new Array(numPages), (el, index) => (
                 <div key={`page_${index + 1}`} className="mb-4 relative shadow-xs bg-white rounded-lg overflow-hidden border border-slate-200">
                   <Page 
                     pageNumber={index + 1} 
                     renderTextLayer={false} 
                     renderAnnotationLayer={false}
                     width={440}
                   />
                   {flags.length > 0 && (
                     <div className="absolute inset-0 border border-rose-500/20 bg-rose-500/[0.02] pointer-events-none" />
                   )}
                 </div>
              ))}
            </Document>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-600 space-y-4 max-w-xs my-auto bg-white border border-slate-200/80 rounded-2xl shadow-xs">
            <div className="w-12 h-12 bg-slate-100 rounded-xl mx-auto flex items-center justify-center text-slate-700">
              <FileText size={24} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-900">Word Document (.docx)</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Native inline preview is optimized for PDF files. You can download or open the original lesson plan below.
              </p>
            </div>
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-all shadow-2xs"
            >
              <span>Download Lesson Plan</span>
              <ExternalLink size={13} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
