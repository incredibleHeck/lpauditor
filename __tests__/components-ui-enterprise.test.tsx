import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import DashboardPageContent from "@/components/DashboardPageContent";
import { SubmissionsTable } from "@/components/SubmissionsTable";
import DepartmentKPIs from "@/components/hod/DepartmentKPIs";
import AuditDetailsModal from "@/components/AuditDetailsModal";
import type { Submission, Audit, UserProfile } from "@/lib/types";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
}));

jest.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({ exists: false }),
  },
  adminAuth: {},
}));

jest.mock("@/app/actions/submissions", () => ({
  getUserSubmissions: jest.fn().mockResolvedValue({ success: true, data: [] }),
  submitLessonPlan: jest.fn().mockResolvedValue({ success: true }),
  updateSubmissionDecision: jest.fn().mockResolvedValue({ success: true }),
  retrySubmissionAudit: jest.fn().mockResolvedValue({ success: true }),
}));

// Mock Firebase
jest.mock("@/lib/firebase", () => ({
  auth: { currentUser: { uid: "test-user-1", email: "test@stadelaideschool.com" } },
  db: {},
}));

jest.mock("firebase/auth", () => ({
  signOut: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  onSnapshot: jest.fn(() => () => {}),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe("Component UI & Enterprise Print Styles Suite", () => {
  describe("Institutional Command Header & Role Switching", () => {
    const mockHODProfile: UserProfile = {
      id: "hod-1",
      full_name: "Mrs. Abigail Sackey",
      email: "abigailsackey@stadelaideschool.com",
      department: "Upper Primary",
      role: "HOD",
    };

    it("should render institutional command header with Cambridge accreditation GH-924 and faculty metadata", () => {
      render(
        <DashboardPageContent
          initialSubmissions={[]}
          teacherId="hod-1"
          profile={mockHODProfile}
        />
      );

      // Check School Name and Cambridge GH-924 accreditation
      expect(screen.getByText("St. Adelaide International School")).toBeInTheDocument();
      expect(screen.getByText("GH-924")).toBeInTheDocument();
      expect(screen.getByText("Cambridge International")).toBeInTheDocument();

      // Check teacher name and role badge
      expect(screen.getByText("Mrs. Abigail Sackey")).toBeInTheDocument();
      expect(screen.getByText("HOD • Upper Primary")).toBeInTheDocument();
      expect(screen.getByText(/Pedagogical Audit Engine v2.1 Active/i)).toBeInTheDocument();
    });

    it("should allow HOD/Admin to toggle between Teacher Workspace and Department Governance tabs", () => {
      render(
        <DashboardPageContent
          initialSubmissions={[]}
          teacherId="hod-1"
          profile={mockHODProfile}
        />
      );

      const teacherTab = screen.getByRole("tab", { name: /Teacher Workspace/i });
      const hodTab = screen.getByRole("tab", { name: /Department Governance/i });

      expect(teacherTab).toBeInTheDocument();
      expect(hodTab).toBeInTheDocument();

      // Default active tab is teacher workspace
      expect(teacherTab).toHaveAttribute("aria-selected", "true");
      expect(hodTab).toHaveAttribute("aria-selected", "false");

      // Switch to Department Governance
      fireEvent.click(hodTab);
      expect(hodTab).toHaveAttribute("aria-selected", "true");
      expect(teacherTab).toHaveAttribute("aria-selected", "false");
    });
  });

  describe("Submissions Data Grid & Quota Indicators", () => {
    const mockSubmissions: Submission[] = [
      {
        id: "sub-1",
        teacher_id: "teacher-1",
        subject: "Primary Science",
        grade_level: "Year 5A",
        week_name: "Week 1",
        status: "COMPLETED",
        hod_decision: "APPROVED",
        file_url: "https://storage.googleapis.com/test/uuid_science_w1.pdf",
        version: 2,
        created_at: new Date().toISOString(),
        profiles: {
          full_name: "Mr. Derrick Thompson",
          department: "ICT",
        },
        ai_audits: [
          {
            id: "audit-1",
            submission_id: "sub-1",
            score: 88,
            lessons_detected: 2,
            strengths: ["Great inquiry tasks"],
            flags: [],
            raw_response: {},
            created_at: new Date().toISOString(),
          },
        ],
      },
    ];

    it("should render Cambridge scores, status badges, version indicators, and decisions in SubmissionsTable", () => {
      const onViewAudit = jest.fn();

      render(
        <SubmissionsTable
          submissions={mockSubmissions}
          showTeacherColumn={true}
          onViewAudit={onViewAudit}
        />
      );

      // Check filename and version
      expect(screen.getByText("science_w1.pdf")).toBeInTheDocument();
      expect(screen.getByText("v2")).toBeInTheDocument();

      // Check faculty name, subject, and week
      expect(screen.getByText("Mr. Derrick Thompson")).toBeInTheDocument();
      expect(screen.getByText("Primary Science")).toBeInTheDocument();
      expect(screen.getByText("Week 1")).toBeInTheDocument();
      expect(screen.getByText("Year 5A")).toBeInTheDocument();

      // Check status and score
      expect(screen.getByText(/Audited/i)).toBeInTheDocument();
      expect(screen.getByText("88%")).toBeInTheDocument();
      expect(screen.getByText(/Approved/i)).toBeInTheDocument();
    });

    it("should render KPI cards with average score, pass benchmark (≥70%), pipeline, and underperforming count", () => {
      const mockStats = {
        totalCount: 15,
        completedCount: 12,
        pendingCount: 2,
        failedCount: 1,
        averageScore: 78,
        underperformingCount: 2,
        commonFlags: ["Missing plenary", "Differentiation needed"],
      };

      render(<DepartmentKPIs stats={mockStats} loading={false} />);

      // Average score card
      expect(screen.getByText("78%")).toBeInTheDocument();
      expect(screen.getByText("(Compliant ≥ 70%)")).toBeInTheDocument();

      // Pipeline counts
      expect(screen.getByText(/12 Audited/i)).toBeInTheDocument();
      expect(screen.getByText(/2 Pending/i)).toBeInTheDocument();
      expect(screen.getByText(/1 Failed/i)).toBeInTheDocument();
      expect(screen.getByText(/Total Uploads: 15/i)).toBeInTheDocument();

      // Pedagogical intervention flags (< 70%)
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText(/Plans Flagged/i)).toBeInTheDocument();
    });
  });

  describe("Cambridge Audit Document Sheet & Native @media print Layout", () => {
    const mockAudit: Audit = {
      id: "audit-sheet-1",
      submission_id: "sub-100",
      score: 84,
      lessons_detected: 4,
      strengths: ["Strong learner attributes", "Active collaborative inquiry"],
      flags: ["Formative assessment rubric can be sharpened"],
      cambridge_attributes: {
        confident: 9,
        responsible: 8,
        reflective: 6,
        innovative: 8,
        engaged: 9,
      },
      cognitive_demand: {
        low_recall: 20,
        medium_application: 50,
        high_evaluation: 30,
      },
      raw_response: {},
      created_at: new Date().toISOString(),
    };

    const mockSubmission: Submission = {
      id: "sub-100",
      teacher_id: "teacher-1",
      subject: "Mathematics",
      grade_level: "Year 6A",
      week_name: "Week 3",
      status: "COMPLETED",
      file_url: "https://storage.googleapis.com/plans/math_y6.pdf",
      created_at: new Date().toISOString(),
      ai_audits: [mockAudit],
    };

    it("should render Cambridge evaluation sheet with Print button and print-ready CSS classes", () => {
      window.print = jest.fn();

      render(
        <AuditDetailsModal
          isOpen={true}
          onClose={jest.fn()}
          audit={mockAudit}
          submission={mockSubmission}
          fileName="math_y6.pdf"
          userRole="HOD"
          teacherName="Mr. Samuel Gyasi"
        />
      );

      // Verify Cambridge header elements
      expect(screen.getByText(/Official Pedagogical Evaluation Document/i)).toBeInTheDocument();
      expect(screen.getByText("84%")).toBeInTheDocument();

      // Verify Print button is present
      const printButtons = screen.getAllByRole("button", { name: /Print/i });
      expect(printButtons.length).toBeGreaterThanOrEqual(1);

      // Trigger print
      fireEvent.click(printButtons[0]);
      expect(window.print).toHaveBeenCalledTimes(1);

      // Verify that print-specific utility classes are rendered for the document layout
      const printBreakElements = document.querySelectorAll(".print-break-inside-avoid");
      expect(printBreakElements.length).toBeGreaterThan(0);

      // Verify no-print class is applied to interactive preview/chat headers
      const noPrintElements = document.querySelectorAll(".no-print");
      expect(noPrintElements.length).toBeGreaterThan(0);
    });
  });
});
