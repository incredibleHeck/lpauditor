---
name: webapp-testing
description: Enterprise testing standards for Next.js 16, React 19, Server Actions, DOCX document pipelines, and Meta WhatsApp Cloud API notification mocks using Jest and React Testing Library.
license: MIT
---

# Web App Testing Guidelines

## 1. Unit & Integration Testing Strategy

- **Location:** Place test suites inside `__tests__/` mirroring source file structure.
- **External Dependencies:** Strictly isolate third-party external services via typed `jest.mock()`:
  - Google Firebase Admin (Auth, Firestore, Cloud Storage)
  - Google Gemini 3.8 Flash API (`@google/genai` SDK)
  - Inngest background event workflows (`lib/inngest/client`)
  - Meta WhatsApp Cloud API (`lib/whatsapp.ts`) — standardized on native Graph API v20.0 (no Twilio, Telegram, or third-party SDKs)
- **Negative & Security Test Cases:**
  - Role-based privilege escalation (preventing self-assignment to `ADMIN` on registration).
  - Unverified email rejections and unauthenticated server action executions.
  - CSV formula injection protection (verifying `=`, `+`, `-`, `@` are prefixed with `'`).
  - Meta WhatsApp payload safety: message chunking at 4,096 characters, E.164 phone normalization, and 1-click wa.me nudge URLs.

## 2. Server Actions & Backend Verification

- **Header & Auth Mocks:** Mock Next.js `cookies()`, session token decoders, and Firebase custom claims.
- **Return Signature:** Enforce uniform action returns: `{ success: true, data }` or `{ success: false, error }`.
- **Department Analytics:** Ensure aggregations include both `COMPLETED` and `RESUBMISSION_REQUIRED` submissions so failing plans (<70%) are factored into underperforming counts and department averages.

## 3. Academic Quota & Timetable Logic

- **Defaulters Engine:** Test classification across `COMPLIANT`, `PARTIALLY_SUBMITTED`, and `DEFAULTER` states.
- **Cambridge Quota Rules:**
  - **Joint Class Deduplication:** Confirm joint sessions (e.g., Year 2–7 PE for Miss Ruth Lartey) collapse into single expected weekly quotas (normalized to 8 quotas) rather than duplicate individual class requirements.
  - **Double Stream Collapse:** Confirm multi-stream classes (e.g., Year 5 Streams A & B) collapse into single quotas.
- **Exclusion Filters:** Verify zero-quota faculty (Nursery educators, non-teaching administrative leadership) are strictly excluded from compliance checks.

## 4. Document Parsing & Upload Pipelines

- **Buffer & Size Guards:** Enforce buffer parsing limits (<10MB) and strict MIME guards (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`). Reject oversized or corrupted buffers.
- **Real-Sample Ingestion:** Verify real-world `.docx` files parse cleanly without encoding errors, extracting structured pedagogical sections (Objectives, Starter, Main Activities, Plenary, Differentiation).
- **Offline Sync & Fallbacks:** Test IndexedDB queue synchronization and deterministic offline mock AI fallback.

## 5. Typing & Runner Standards

- **TypeScript Integrity:** All test files must pass `npx tsc --noEmit` with zero errors. Include `@testing-library/jest-dom` types in `tsconfig.json`.
- **Exit Codes:** CI/CD runners must execute tests with clean 0 exit codes and 100% assertion pass rates across all suites.

