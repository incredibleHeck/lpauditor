# HecTech LPAuditor 🎓🤖

**HecTech LPAuditor** is an enterprise-grade pedagogical auditing and compliance platform designed for schools and EdTech institutions. It automates compliance reviews for weekly Cambridge-aligned lesson plans using Google's **Gemini 3.8 Flash** and **Firebase** infrastructure operating on Google's perpetual **Free Tier ($0/month)**.

---

## 🚀 Key Features

* **Multimodal Document Analysis**: Direct ingestion and processing of `.pdf` and `.docx` lesson plans with progress tracking and IndexedDB offline queueing.
* **Cambridge & Universal Pedagogical Rubrics**: Automated evaluation against Cambridge International Standards v2.1 across 10 subject departments, with automatic fallback to universal pedagogical rubrics for non-Cambridge or custom subjects.
* **Mandatory 70% Resubmission Threshold**: Automatic status gating for any lesson plan scoring below **70%** (7.0/10), setting `RESUBMISSION_REQUIRED`, flagging critical compliance failures, and blocking HOD approval until a compliant revision is submitted.
* **Interactive AI Auditor Chat**: Multi-turn chat assistant powered by `gemini-3.8-flash`, enabling teachers to ask specific questions about addressing compliance flags and boosting active student inquiry.
* **HOD & Admin Portal**: Department-level KPI tracking, real-time weekly executive briefings, side-by-side PDF preview, and CSV compliance report export.
* **Automated WhatsApp Defaulter Alerts & 1-Click Nudges**: Cross-references faculty rosters with weekly submissions to detect defaulters, with automated Friday cron dispatches and on-demand 1-click WhatsApp nudges.
* **Strict Role-Based Access Control (RBAC)**: Enforced via Cloud Firestore security rules, Firebase Storage security rules, Next.js edge proxy (`proxy.ts`), and server action permission checks.

---

## 🛠 Tech Stack

* **Frontend & Server Framework**: [Next.js 16.2](https://nextjs.org/) (App Router, Turbopack), React 19, TypeScript
* **Styling & UI**: Tailwind CSS v4, Lucide React, Sonner, Shadcn/ui (Base UI)
* **Authentication**: Firebase Authentication with HTTP-only session cookies
* **Database**: Cloud Firestore (NoSQL)
* **File Vault**: Cloud Storage for Firebase
* **AI Engine**: `@google/generative-ai` with **Gemini 3.8 Flash** (Structured JSON output + runtime Zod validation)
* **Background Queue**: [Inngest](https://www.inngest.com/) step functions & cron triggers
* **Testing**: Jest 30, React Testing Library, ts-node (25 unit/integration tests)

---

## 📦 Project Structure

```text
├── app/
│   ├── actions/
│   │   ├── ai.ts              # Gemini 3.7 Flash chat assistant & department analytics
│   │   ├── notifications.ts   # Defaulters report & Telegram dispatch actions
│   │   └── submissions.ts     # Lesson plan submissions, revisions, & HOD decisions
│   ├── api/
│   │   ├── auth/session/      # Session cookie creation & deletion endpoints
│   │   └── inngest/           # Inngest background event handler route
│   ├── auth/
│   │   ├── login/             # Institutional login page
│   │   ├── signin/            # Signin redirect handler
│   │   └── signup/            # Teacher registration page
│   ├── layout.tsx             # Root layout with Sonner toast provider
│   ├── page.tsx               # Main Dashboard entry point
│   └── globals.css            # Tailwind CSS styling & theme variables
├── components/
│   ├── audit/
│   │   ├── CertificateExportModal.tsx # Printable compliance certificate modal
│   │   ├── DocumentPreview.tsx        # Side-by-side PDF / Word viewer
│   │   ├── HODDecisionPanel.tsx       # Approval gate & pedagogical review panel
│   │   └── ScoreRing.tsx              # SVG radial score indicator
│   ├── hod/
│   │   ├── DefaultersPanel.tsx        # Defaulter tracking & academic week switcher
│   │   └── DepartmentKPIs.tsx         # Department analytics KPI cards
│   ├── ui/
│   │   ├── ComplianceScoreCell.tsx    # Table cell with color-coded score badge
│   │   ├── HodDecisionBadge.tsx       # Decision status badge
│   │   ├── StatusBadge.tsx            # Submission status badge (including Resubmission)
│   │   └── button.tsx                 # Base UI button component
│   ├── AuditDetailsModal.tsx          # Full diagnostic report modal & AI chat
│   ├── ChatPanel.tsx                  # Interactive Gemini pedagogical chat component
│   ├── DashboardPageContent.tsx       # Teacher & HOD portal tab container
│   ├── ErrorBoundary.tsx              # React error boundary component
│   ├── HODDashboard.tsx               # Department head compliance & tracking portal
│   ├── LessonPlanDropzone.tsx         # Upload dropzone with IndexedDB offline queue
│   ├── SubmissionsDashboard.tsx       # Teacher submissions list
│   └── SubmissionsTable.tsx           # Reusable data table for submissions
├── lib/
│   ├── inngest/
│   │   ├── client.ts                  # Inngest client and typed event schema
│   │   └── functions.ts               # Background audit worker & defaulters cron
│   ├── schemas/
│   │   ├── actionSchemas.ts           # Zod validation schemas for Server Actions
│   │   └── auditSchema.ts             # Gemini response schema + runtime Zod schema
│   ├── auth-helpers.ts                # Session cookie & ID token verification
│   ├── constants.ts                   # Institutional configuration & scoring thresholds
│   ├── defaulters.ts                  # Defaulter calculation engine & academic week helper
│   ├── firebase-admin.ts              # Server Firebase Admin SDK singleton
│   ├── firebase.ts                    # Client Firebase Web SDK singleton
│   ├── format-utils.ts                # Date, filename, & audit formatting helpers
│   ├── gemini.ts                      # GoogleGenerativeAI client singleton
│   ├── logger.ts                      # Pino structured logger
│   ├── rubric.ts                      # Cambridge standards, subject guides, & fallback rubric
│   ├── telegram.ts                    # Telegram Bot API message formatting & dispatch
│   └── types.ts                       # Shared TypeScript interfaces & types
├── __tests__/                         # Comprehensive Jest test suite (25 tests)
│   ├── actionSchemas.test.ts
│   ├── auth-helpers.test.ts
│   ├── defaulters.test.ts
│   ├── rubric-fallback.test.ts
│   ├── submissions.test.ts
│   ├── telegram.test.ts
│   ├── threshold-enforcement.test.ts
│   └── zod-audit-schema.test.ts
├── firestore.rules                    # Cloud Firestore security rules
├── storage.rules                      # Firebase Cloud Storage security rules
├── firebase.json                      # Firebase project configuration
├── proxy.ts                           # Next.js 16 Edge request proxy
├── architecture.md                    # Technical architecture blueprint
└── PROJECT_STATUS_AND_HANDOVER.md     # Developer status & handover document
```

---

## ⚡ Getting Started Locally

### 1. Prerequisites
* Node.js 20+ installed
* A Google Cloud / Firebase account with Firestore and Storage enabled
* A Gemini API Key from [Google AI Studio](https://aistudio.google.com/)
* *(Optional)* A Telegram Bot Token and Chat ID for automated alerts

### 2. Environment Setup
Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Optional Service Account Key JSON (Base64 or JSON string)
# FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# Gemini API Key (Gemini 3.7 Flash)
GEMINI_API_KEY=your_gemini_api_key

# Telegram Bot Credentials (for defaulter alerts)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id

# Inngest Dev Server Flag
INNGEST_DEV=1
```

### 3. Installation & Local Development

```bash
# Install dependencies
npm install

# Run Jest unit test suite
npm test

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 🧪 Testing & Verification

Run the comprehensive test suite covering all server actions, Zod schemas, threshold enforcement gates, and fallback rubrics:

```bash
npm test
```

Build the production bundle with Next.js Turbopack:

```bash
npm run build
```

---

## 📄 Documentation

* **[Architecture Blueprint](./architecture.md)** — Detailed technical design and dataflow diagrams.
* **[Project Status & Handover Document](./PROJECT_STATUS_AND_HANDOVER.md)** — Milestones, security policies, and production readiness roadmap.

---

© 2026 St. Adelaide International School • Powered by Google Ecosystem & Gemini 3.7 Flash.
