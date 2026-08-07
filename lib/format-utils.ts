// ============================================================
// Shared Formatting Utilities
// ============================================================

import type { Audit, Submission } from "./types";

/**
 * Extracts a human-readable filename from a Firebase Storage URL.
 */
export function getFileName(url: string): string {
  try {
    const parts = url.split("/");
    const rawName = parts[parts.length - 1];
    const cleanParts = rawName.split("_");
    if (cleanParts.length > 1) {
      return cleanParts.slice(1).join("_");
    }
    return rawName;
  } catch {
    return "Document.pdf";
  }
}

/**
 * Formats a date string into a short, human-readable format.
 */
export function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Recent";
  }
}

/**
 * Extracts the first Audit from a submission's ai_audits field,
 * handling both array and single-object shapes.
 */
export function getAuditFromSubmission(sub: Submission): Audit | null {
  const raw = sub.ai_audits;
  if (Array.isArray(raw)) {
    return raw.length > 0 ? raw[0] : null;
  }
  return raw;
}
