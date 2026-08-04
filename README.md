# HecTech LPAuditor 🎓🤖

**HecTech LPAuditor** is an enterprise-grade, AI-powered pedagogical auditing system designed for schools and EdTech institutions. It automates compliance reviews for weekly Cambridge-aligned lesson plans using Google's **Gemini 3.6 Flash** and **Firebase** infrastructure operating on Google's perpetual **Free Tier ($0/month)**.

---

## 🚀 Key Features

* **Multimodal Document Analysis**: Direct ingestion and processing of `.pdf` and `.docx` lesson plans.
* **Cambridge Rubric Alignment**: Automated scoring (0-100%), distinct lesson segment counting, strength identification, and compliance flag detection.
* **Interactive AI Auditor Chat**: Multi-turn chat assistant allowing teachers to ask specific questions about their audit findings.
* **HOD Department Analytics**: Real-time weekly syntheses, class averages, and critical underperformance tracking for Heads of Department.
* **Offline Resilience**: Automatic queueing of uploads in `IndexedDB` when offline, with auto-sync upon reconnecting.
* **Google Ecosystem Core**: Powered by Firebase Authentication, Cloud Firestore, Cloud Storage for Firebase, and Google AI Studio.

---

## 🛠 Tech Stack

* **Frontend & Server Framework**: [Next.js 16.2](https://nextjs.org/) (App Router), React 19, TypeScript
* **Styling**: Tailwind CSS v4, Lucide React, Shadcn/ui (Base UI)
* **Authentication**: Firebase Authentication
* **Database**: Cloud Firestore (NoSQL)
* **File Vault**: Cloud Storage for Firebase
* **AI Engine**: `@google/generative-ai` with **Gemini 3.6 Flash**
* **Background Queue**: [Inngest](https://www.inngest.com/) step functions

---

## 📦 Project Structure

```text
├── app/
│   ├── actions/
│   │   └── submissions.ts     # Server actions (Firestore CRUD, Gemini 3.6 Flash chat & analytics)
│   ├── api/
│   │   └── inngest/           # Inngest background event handler route
│   ├── auth/
│   │   ├── login/             # Firebase Auth login page
│   │   └── signup/            # Firebase Auth signup page
│   ├── layout.tsx
│   └── page.tsx               # Main Dashboard entry point
├── components/
│   ├── AuditDetailsModal.tsx  # Interactive audit feedback & AI auditor chat modal
│   ├── DashboardPageContent.tsx # Teacher main portal layout
│   ├── HODDashboard.tsx       # Department head analytics & weekly briefing view
│   ├── LessonPlanDropzone.tsx # Drag-and-drop uploader with IndexedDB offline queueing
│   └── SubmissionsDashboard.tsx# Teacher submission list with Firestore real-time onSnapshot
├── lib/
│   ├── firebase.ts            # Client Firebase Web SDK initialization
│   ├── firebase-admin.ts      # Server Firebase Admin SDK initialization
│   ├── inngest/
│   │   └── functions.ts       # Atomic 6-step Gemini 3.6 Flash audit background worker
│   └── rubric.ts              # Cambridge subject yardsticks & prompt templates
├── firestore.rules            # Firestore security rules
├── storage.rules              # Cloud Storage security rules
├── firebase.json              # Firebase project deployment manifest
└── PROJECT_STATUS_AND_HANDOVER.md # Developer handover documentation
```

---

## ⚡ Getting Started Locally

### 1. Prerequisites
* Node.js 20+ installed
* A Google Cloud / Firebase account
* A Gemini API Key from [Google AI Studio](https://aistudio.google.com/)

### 2. Environment Setup
Copy or edit `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Gemini API Paid / High-Quota Key
GEMINI_API_KEY=your_gemini_api_key

INNGEST_DEV=1
```

### 3. Installation & Local Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

---

## 📄 Documentation & Handover

For detailed technical history, completed milestones, architectural blueprints, and next steps for developers, consult:
👉 **[PROJECT_STATUS_AND_HANDOVER.md](./PROJECT_STATUS_AND_HANDOVER.md)**

---

© 2026 HecTech Ltd. Powered by Google Ecosystem & Gemini 3.6 Flash.
