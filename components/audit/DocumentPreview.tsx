import React, { useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DocumentPreviewProps {
  fileName: string;
  fileUrl: string | undefined;
  isPdf: boolean;
  flags?: string[];
}

export default function DocumentPreview({ fileName, fileUrl, isPdf, flags = [] }: DocumentPreviewProps) {
  const [numPages, setNumPages] = useState<number>();

  function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
    setNumPages(numPages);
  }

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
      <div className="flex-1 bg-zinc-800 overflow-y-auto flex flex-col items-center justify-start py-4 relative">
        {isPdf ? (
          <div className="flex flex-col items-center w-full relative">
            <Document 
              file={fileUrl} 
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<div className="text-zinc-400 mt-10">Loading PDF...</div>}
              className="flex flex-col items-center"
            >
              {numPages && Array.from(new Array(numPages), (el, index) => (
                 <div key={`page_${index + 1}`} className="mb-4 relative shadow-lg">
                   <Page 
                     pageNumber={index + 1} 
                     renderTextLayer={false} 
                     renderAnnotationLayer={false}
                     width={450}
                   />
                   {flags.length > 0 && (
                     <div className="absolute inset-0 border-2 border-red-500/30 bg-red-500/5 pointer-events-none" />
                   )}
                 </div>
              ))}
            </Document>
          </div>
        ) : (
          <div className="p-8 text-center text-zinc-300 space-y-4 max-w-sm mt-20">
            <FileText className="mx-auto h-16 w-16 text-zinc-500" />
            <p className="text-sm font-semibold">Word Document (.docx) Preview</p>
            <p className="text-xs text-zinc-400">
              PDF previewer is optimized for PDF documents. Click below to view or download the uploaded lesson plan file.
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
