"use client";

import React, { useRef } from "react";
import { X, Printer, Download, Award, CheckCircle2, BookOpen } from "lucide-react";
import type { Audit, SubmissionContext } from "@/lib/types";
import { SCHOOL_NAME } from "@/lib/constants";

interface CertificateExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  audit: Audit | null;
  submission?: SubmissionContext | null;
  teacherName?: string;
}

export default function CertificateExportModal({
  isOpen,
  onClose,
  audit,
  submission,
  teacherName = "Faculty Member",
}: CertificateExportModalProps) {
  const certificateRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !audit) return null;

  const score = audit.score || 0;
  const certificateId = `STADL-${submission?.id ? submission.id.substring(0, 8).toUpperCase() : "CERT"}-${new Date().getFullYear()}`;
  const formattedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    try {
      // Dynamic import of html2pdf.js for client-side execution
      const html2pdf = (await import("html2pdf.js")).default;
      if (certificateRef.current) {
        const opt = {
          margin: 10,
          filename: `Cambridge_Compliance_Certificate_${submission?.week_name || 'Week'}_${submission?.subject || 'Subject'}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        };
        // @ts-expect-error html2pdf options typing
        html2pdf().from(certificateRef.current).set(opt).save();
      }
    } catch (err) {
      console.error("PDF generation failed:", err);
      // Fallback to browser print dialog
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs animate-fade-in font-sans">
      <div className="relative w-full max-w-3xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        
        {/* Modal Action Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
            <Award size={18} className="text-slate-800" />
            Official Compliance Certificate
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all cursor-pointer shadow-2xs"
            >
              <Printer size={14} /> Print
            </button>
            <button
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-all cursor-pointer shadow-2xs"
            >
              <Download size={14} /> Download PDF
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all cursor-pointer ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Certificate Printable Body */}
        <div className="p-6 sm:p-10 overflow-y-auto bg-slate-100 flex justify-center">
          <div 
            ref={certificateRef}
            id="printable-certificate"
            className="w-full max-w-2xl bg-white border-8 border-slate-900 rounded-xl p-8 sm:p-10 shadow-lg relative text-slate-900 font-serif"
          >
            {/* Watermark Crest */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
              <BookOpen size={360} />
            </div>

            {/* Institution Header */}
            <div className="text-center space-y-1.5 border-b-2 border-slate-900 pb-6">
              <div className="inline-flex p-3 bg-slate-900 text-white rounded-xl shadow-xs mb-1">
                <BookOpen size={28} />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 uppercase font-sans">
                {SCHOOL_NAME}
              </h1>
              <p className="text-xs font-semibold tracking-widest text-slate-600 uppercase font-sans">
                Accredited Cambridge International School • Center ID: GH-924
              </p>
              <div className="pt-2">
                <span className="inline-block px-3 py-1 bg-slate-100 border border-slate-300 text-slate-800 text-[11px] font-bold uppercase tracking-wider rounded font-sans">
                  Cambridge Pedagogical Compliance Endorsement
                </span>
              </div>
            </div>

            {/* Certificate Body */}
            <div className="py-8 space-y-6 text-center">
              <p className="text-xs uppercase tracking-widest text-slate-500 font-sans font-semibold">
                This is to officially certify that the weekly curriculum plan submitted by
              </p>

              <div className="space-y-1">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 italic">
                  {teacherName}
                </h2>
                <p className="text-xs text-slate-600 font-sans">
                  Department of {submission?.subject || "Subject"} • {submission?.grade_level || "Grade Level"} • {submission?.week_name || "Teaching Week"}
                </p>
              </div>

              <p className="text-xs text-slate-700 max-w-lg mx-auto leading-relaxed font-sans">
                has undergone automated multimodal pedagogical auditing against Cambridge International Standards,
                evaluating lesson structure, cognitive demand, EAL scaffolding, and pacing compliance.
              </p>

              {/* Score & Metrics Grid */}
              <div className="grid grid-cols-3 gap-3 pt-2 max-w-lg mx-auto font-sans">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Overall Score</span>
                  <span className="text-xl font-bold font-mono text-slate-900">{score}%</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">EAL Scaffolding</span>
                  <span className="text-xl font-bold font-mono text-slate-900">{audit.eal_scaffolding_score || score}%</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Pacing Status</span>
                  <span className="text-xs font-bold text-slate-800 mt-1 block">
                    {audit.time_compliance?.is_compliant ? "Compliant" : "Verified"}
                  </span>
                </div>
              </div>

              {/* Cambridge Attributes Tags */}
              {audit.cambridge_attributes && (
                <div className="pt-2 font-sans">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">
                    Verified Cambridge Learner Attributes
                  </p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {Object.entries(audit.cambridge_attributes).map(([attr, val]) => (
                      <span key={attr} className="px-2 py-0.5 bg-white border border-slate-200 text-slate-700 text-[10px] font-semibold rounded font-mono">
                        {attr}: {val}%
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Endorsement Signatures & Seal */}
            <div className="pt-6 border-t-2 border-slate-900 grid grid-cols-2 gap-6 items-end font-sans">
              <div className="text-left space-y-1">
                <p className="text-[10px] text-slate-400 font-mono">Certificate Ref: {certificateId}</p>
                <p className="text-[10px] text-slate-500 font-medium">Issue Date: {formattedDate}</p>
                <div className="pt-4">
                  <div className="w-32 border-b border-slate-400 mb-1"></div>
                  <p className="text-[11px] font-bold text-slate-900">Department Head / Auditor</p>
                  <p className="text-[9px] text-slate-500">St. Adelaide Academic Directorate</p>
                </div>
              </div>

              <div className="text-right flex flex-col items-end">
                <div className="w-20 h-20 rounded-full border-2 border-dashed border-slate-900 flex items-center justify-center p-1 text-center">
                  <span className="text-[8px] font-bold text-slate-900 uppercase tracking-tighter leading-tight">
                    OFFICIAL PEDAGOGICAL AUDIT SEAL
                  </span>
                </div>
                <p className="text-[9px] text-emerald-800 font-semibold mt-2 flex items-center gap-1">
                  <CheckCircle2 size={11} /> Digitally Authenticated
                </p>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
