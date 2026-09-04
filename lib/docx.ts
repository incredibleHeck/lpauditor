import JSZip from "jszip";
import { logger } from "./logger";

/**
 * Standard DOCX MIME type and maximum payload size (10MB)
 */
export const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const MAX_DOCX_BUFFER_SIZE = 10 * 1024 * 1024; // 10MB limit

export interface DocxMetadata {
  teacher?: string;
  subject?: string;
  gradeLevel?: string;
  week?: string;
  term?: string;
  topic?: string;
  periods?: string;
}

export interface DocxStructuredSections {
  rawText: string;
  objectives: string;
  starter: string;
  mainActivities: string;
  plenary: string;
  differentiation: string;
  metadata: DocxMetadata;
}

export interface ParseDocxOptions {
  maxSizeBytes?: number;
  mimeType?: string;
  filename?: string;
}


/**
 * Validates buffer size and zip magic bytes (PK\x03\x04)
 */
export function validateDocxBuffer(
  buffer: Buffer | Uint8Array,
  options?: ParseDocxOptions
): void {
  const maxSize = options?.maxSizeBytes ?? MAX_DOCX_BUFFER_SIZE;

  if (!buffer || buffer.length === 0) {
    throw new Error("DOCX buffer is empty or undefined.");
  }

  if (buffer.length > maxSize) {
    throw new Error(
      `DOCX buffer exceeds maximum allowed limit of ${maxSize / (1024 * 1024)}MB (actual: ${(
        buffer.length /
        (1024 * 1024)
      ).toFixed(2)}MB).`
    );
  }

  if (options?.mimeType && options.mimeType !== DOCX_MIME_TYPE) {
    throw new Error(
      `Invalid MIME type: "${options.mimeType}". Expected "${DOCX_MIME_TYPE}".`
    );
  }

  // Check ZIP archive magic bytes (PK\x03\x04)
  const isZip =
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04;

  if (!isZip) {
    throw new Error(
      "Invalid DOCX file format: missing valid ZIP archive header (PK\\x03\\x04)."
    );
  }
}

/**
 * Extracts normalized plain text from DOCX XML with XML entity decoding
 */
function extractTextFromDocumentXml(xml: string): string {
  return xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<\/w:tc>/g, " | ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/[ \t]+/g, " ");
}

/**
 * Extracts structured pedagogical sections and metadata from DOCX text.
 */
function extractSectionsFromText(
  text: string,
  filename?: string
): DocxStructuredSections {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Metadata extraction
  const metadata: DocxMetadata = {};

  // Extract Teacher Name
  const aryikuMatch = text.match(/Mr\.\s+Hector\s+Aryiku/i) ||
    text.match(/Mr\.\s+Ayiku/i) ||
    text.match(/(?:Mr\.|Mrs\.|Ms\.|Miss|Dr\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/);
  if (aryikuMatch) {
    metadata.teacher = aryikuMatch[0].trim();
  }

  // Extract Subject
  const compMatch = text.match(/Computing\s+and\s+Digital\s+Literacy/i) ||
    text.match(/\b(ICT|Computing|Mathematics|Science|English|French|PE|Robotics)\b/i);
  if (compMatch) {
    metadata.subject = compMatch[0].trim();
  }

  // Extract Grade/Year Level
  const gradeMatch = text.match(/(?:Grade|Year)\s*(\d+)/i) ||
    (filename ? filename.match(/(?:Grade|Year)\s*(\d+)/i) : null);
  if (gradeMatch) {
    metadata.gradeLevel = `Year ${gradeMatch[1]}`;
  }

  // Extract Week: check filename first (e.g. WEEK 4 YEAR 5.docx), or table header
  const fileWeekMatch = filename ? filename.match(/Week\s*(\d+)/i) : null;
  if (fileWeekMatch) {
    metadata.week = `Week ${fileWeekMatch[1]}`;
  } else {
    // Check if table has a row with Week number (e.g. L14 is | 4 after Term 2)
    const tableWeekMatch = text.match(/\|\s*Term[\s\S]*?\|\s*Week[\s\S]*?\|\s*(\d+)\s*\|\s*(\d+)\s*\|/i);
    if (tableWeekMatch) {
      metadata.week = `Week ${tableWeekMatch[2]}`;
    } else {
      const genericWeek = text.match(/\bWeek\s*:\s*(\d+)/i) || text.match(/\bWeek\s*(\d+)\b/i);
      if (genericWeek) {
        metadata.week = `Week ${genericWeek[1]}`;
      }
    }
  }

  // Extract Term
  const termMatch = text.match(/\bTerm\s*(\d+)/i);
  if (termMatch) {
    metadata.term = `Term ${termMatch[1]}`;
  }

  // Extract Topic: look for "Topic:" line and grab text after it (or next line if on separate cell)
  for (let i = 0; i < lines.length; i++) {
    if (/^Topic:?/i.test(lines[i])) {
      const rest = lines[i].replace(/^Topic:?\s*/i, "").replace(/^[|\s]+/, "").trim();
      if (rest.length > 0) {
        metadata.topic = rest;
      } else if (i + 1 < lines.length) {
        metadata.topic = lines[i + 1].replace(/^[|\s]+/, "").trim();
      }
      break;
    }
  }
  if (!metadata.topic) {
    const fallbackTopic = text.match(/(?:Routing\s*&\s*The\s*Journey[^\n|]+|Authentication:\s*Proving\s*Who\s*You\s*Are)/i);
    if (fallbackTopic) {
      metadata.topic = fallbackTopic[0].trim();
    }
  }

  // Extract Periods / Time
  const periodMatch = text.match(/(\d+\s*\(\d+\)\s*minutes)/i) || text.match(/3\s*\(105\)\s*minutes/i);
  if (periodMatch) {
    metadata.periods = periodMatch[0].trim();
  }



  // Section segmenter based on Cambridge lesson plan headings
  const findSectionContent = (
    startRegex: RegExp,
    endRegexes: RegExp[]
  ): string => {
    let capturing = false;
    const captured: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!capturing) {
        if (startRegex.test(line)) {
          capturing = true;
          // If the line has content after the heading, capture it
          const cleaned = line.replace(startRegex, "").replace(/^[:|\s]+/, "").trim();
          if (cleaned.length > 0) {
            captured.push(cleaned);
          }
        }
      } else {
        // Check if hit any end regex
        if (endRegexes.some((re) => re.test(line))) {
          break;
        }
        // Exclude pure table column header artifacts (e.g. "|", "ACTIVITY", "TIME")
        if (!/^(\||\s*ACTIVITY\s*\|\s*TIME\s*\|?)$/i.test(line)) {
          captured.push(line);
        }
      }
    }

    return captured.join("\n").trim();
  };

  const objectives = findSectionContent(
    /(?:Lesson\s+)?objectives:?/i,
    [/(?:Relevant\s+)?Previous\s+Knowledge/i, /Starter/i, /Main/i]
  );

  const starter = findSectionContent(
    /Starter(?:\s+Activity)?:?/i,
    [/Main(?:\s+lesson)?(?:\s+Activities)?:?/i, /Plenary/i]
  );

  const mainActivities = findSectionContent(
    /Main(?:\s+lesson)?(?:\s+Activities)?:?/i,
    [/Plenary(?:\s+Activities)?:?/i, /Assessment/i, /Differentiation/i]
  );

  const plenary = findSectionContent(
    /Plenary(?:\s+Activities)?:?/i,
    [/Assessment(?:\s+Opportunities)?:?/i, /Differentiation/i]
  );

  const differentiation = findSectionContent(
    /Differentiation:?/i,
    [/Teacher(?:'s)?\s+Remarks/i, /Evaluation/i, /End\s+of\s+plan/i]
  );

  return {
    rawText: text,
    objectives: objectives || "No explicit objectives section detected",
    starter: starter || "No explicit starter section detected",
    mainActivities: mainActivities || "No explicit main activities section detected",
    plenary: plenary || "No explicit plenary section detected",
    differentiation: differentiation || "No explicit differentiation section detected",
    metadata,
  };
}

/**
 * Parses a DOCX buffer or Uint8Array into structured pedagogical sections and metadata.
 */
export async function parseDocxBuffer(
  buffer: Buffer | Uint8Array,
  options?: ParseDocxOptions
): Promise<DocxStructuredSections> {
  validateDocxBuffer(buffer, options);

  try {
    const zip = await JSZip.loadAsync(buffer);
    const documentXmlFile = zip.file("word/document.xml");

    if (!documentXmlFile) {
      throw new Error("Invalid DOCX file: missing word/document.xml");
    }

    const xml = await documentXmlFile.async("string");
    const extractedText = extractTextFromDocumentXml(xml);

    return extractSectionsFromText(extractedText, options?.filename);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error({ error: errorMsg }, "Failed to parse DOCX buffer");
    throw new Error(`Failed to parse DOCX document: ${errorMsg}`);
  }
}

/**
 * Extracts raw normalized text from a DOCX buffer.
 */
export async function extractRawTextFromDocx(
  buffer: Buffer | Uint8Array,
  options?: ParseDocxOptions
): Promise<string> {
  const sections = await parseDocxBuffer(buffer, options);
  return sections.rawText;
}
