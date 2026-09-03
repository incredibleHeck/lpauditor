import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { HodDecisionBadge } from "@/components/ui/HodDecisionBadge";
import ScoreRing from "@/components/audit/ScoreRing";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import HODDecisionPanel from "@/components/audit/HODDecisionPanel";
import DefaultersPanel from "@/components/hod/DefaultersPanel";
import { toast } from "sonner";

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

const mockUpdateSubmissionDecision = jest.fn();
jest.mock("@/app/actions/submissions", () => ({
  updateSubmissionDecision: (...args: any[]) => mockUpdateSubmissionDecision(...args),
}));

describe("React UI Components", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("HodDecisionBadge", () => {
    it("renders Approved badge for APPROVED decision", () => {
      render(<HodDecisionBadge decision="APPROVED" />);
      expect(screen.getByText(/Approved/i)).toBeInTheDocument();
    });

    it("renders Revision Needed badge for REVISION_REQUESTED decision", () => {
      render(<HodDecisionBadge decision="REVISION_REQUESTED" />);
      expect(screen.getByText(/Revision Needed/i)).toBeInTheDocument();
    });

    it("renders Peer Observation badge for NEEDS_OBSERVATION decision", () => {
      render(<HodDecisionBadge decision="NEEDS_OBSERVATION" />);
      expect(screen.getByText(/Peer Observation/i)).toBeInTheDocument();
    });

    it("renders Pending Review for null or undefined decision", () => {
      render(<HodDecisionBadge decision={null} />);
      expect(screen.getByText(/Pending Review/i)).toBeInTheDocument();
    });
  });

  describe("ScoreRing", () => {
    it("renders score percentage and Cambridge label correctly", () => {
      render(<ScoreRing score={85} />);
      expect(screen.getByText("85%")).toBeInTheDocument();
      expect(screen.getByText(/Cambridge/i)).toBeInTheDocument();
    });

    it("handles failing scores properly", () => {
      render(<ScoreRing score={45} />);
      expect(screen.getByText("45%")).toBeInTheDocument();
    });
  });

  describe("ErrorBoundary", () => {
    const ProblemChild = ({ shouldThrow }: { shouldThrow: boolean }) => {
      if (shouldThrow) {
        throw new Error("Test intentional crash");
      }
      return <div>Normal Content</div>;
    };

    it("renders children when no error occurs", () => {
      render(
        <ErrorBoundary>
          <div>Child Content</div>
        </ErrorBoundary>
      );
      expect(screen.getByText("Child Content")).toBeInTheDocument();
    });

    it("catches errors and renders fallback with Try Again button", () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      render(
        <ErrorBoundary>
          <ProblemChild shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Application Error Encountered/i)).toBeInTheDocument();
      expect(screen.getByText(/Test intentional crash/i)).toBeInTheDocument();

      const retryBtn = screen.getByRole("button", { name: /Try Again/i });
      expect(retryBtn).toBeInTheDocument();

      consoleErrorSpy.mockRestore();
    });
  });

  describe("HODDecisionPanel", () => {
    const mockSubmission: any = {
      id: "sub-123",
      teacher_id: "teacher-1",
      subject: "Mathematics",
      status: "COMPLETED",
      requires_resubmission: false,
      hod_decision: null,
      hod_feedback: "Initial feedback",
    };

    it("renders read-only feedback for teachers (non-HOD/Admin)", () => {
      render(
        <HODDecisionPanel
          submission={mockSubmission}
          isHODOrAdmin={false}
          onDecisionUpdated={jest.fn()}
        />
      );

      expect(screen.getByText(/HOD Reviewer Feedback/i)).toBeInTheDocument();
      expect(screen.getByText("Initial feedback")).toBeInTheDocument();
      expect(screen.queryByText(/Approve Plan/i)).not.toBeInTheDocument();
    });

    it("disables Approve Plan button when submission requires resubmission", () => {
      const blockedSubmission = {
        ...mockSubmission,
        requires_resubmission: true,
        status: "RESUBMISSION_REQUIRED",
      };

      render(
        <HODDecisionPanel
          submission={blockedSubmission}
          isHODOrAdmin={true}
          onDecisionUpdated={jest.fn()}
        />
      );

      expect(screen.getByText(/Approval Gated/i)).toBeInTheDocument();
      const approveBtn = screen.getByRole("button", { name: /Approve Plan/i });
      expect(approveBtn).toBeDisabled();
    });

    it("allows approving plan and calls onDecisionUpdated when action succeeds", async () => {
      mockUpdateSubmissionDecision.mockResolvedValueOnce({ success: true });
      const onDecisionUpdated = jest.fn();

      render(
        <HODDecisionPanel
          submission={mockSubmission}
          isHODOrAdmin={true}
          onDecisionUpdated={onDecisionUpdated}
        />
      );

      const approveBtn = screen.getByRole("button", { name: /Approve Plan/i });
      expect(approveBtn).not.toBeDisabled();

      fireEvent.click(approveBtn);

      await waitFor(() => {
        expect(mockUpdateSubmissionDecision).toHaveBeenCalledWith({
          submissionId: "sub-123",
          decision: "APPROVED",
          comments: "Initial feedback",
        });
        expect(toast.success).toHaveBeenCalledWith("Submission marked as APPROVED");
        expect(onDecisionUpdated).toHaveBeenCalledWith("APPROVED");
      });
    });

    it("allows updating notes and requesting revision", async () => {
      mockUpdateSubmissionDecision.mockResolvedValueOnce({ success: true });
      const onDecisionUpdated = jest.fn();

      render(
        <HODDecisionPanel
          submission={mockSubmission}
          isHODOrAdmin={true}
          onDecisionUpdated={onDecisionUpdated}
        />
      );

      const revisionBtn = screen.getByRole("button", { name: /Request Revision/i });
      fireEvent.click(revisionBtn);

      await waitFor(() => {
        expect(mockUpdateSubmissionDecision).toHaveBeenCalledWith({
          submissionId: "sub-123",
          decision: "REVISION_REQUESTED",
          comments: "Initial feedback",
        });
        expect(onDecisionUpdated).toHaveBeenCalledWith("REVISION_REQUESTED");
      });
    });
  });

  describe("DefaultersPanel", () => {
    const mockReport = {
      weekName: "Week 3",
      deadlineDate: "Friday, Sep 18, 2026",
      totalTeachers: 10,
      submittedCount: 8,
      defaulterCount: 2,
      defaulters: [
        { id: "t-1", fullName: "Alice Mensah", email: "alice@school.com", department: "Math" },
        { id: "t-2", fullName: "Bob Kumi", email: "bob@school.com", department: "Science" },
      ],
    };

    it("renders loading skeleton when loading is true", () => {
      const { container } = render(
        <DefaultersPanel
          report={null}
          loading={true}
          onRefresh={jest.fn()}
          onSendAlert={jest.fn()}
          isDispatching={false}
        />
      );

      expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    });

    it("renders stats and defaulters list correctly", () => {
      render(
        <DefaultersPanel
          report={mockReport}
          loading={false}
          onRefresh={jest.fn()}
          onSendAlert={jest.fn()}
          isDispatching={false}
        />
      );

      expect(screen.getByText("10")).toBeInTheDocument(); // totalTeachers
      expect(screen.getByText("8")).toBeInTheDocument(); // submittedCount
      expect(screen.getByText("2")).toBeInTheDocument(); // defaulterCount
      expect(screen.getByText("80%")).toBeInTheDocument(); // 8/10 compliance rate
      expect(screen.getByText("Alice Mensah")).toBeInTheDocument();
      expect(screen.getByText("Bob Kumi")).toBeInTheDocument();
    });

    it("renders 100% celebration banner when 0 defaulters", () => {
      const fullComplianceReport = {
        ...mockReport,
        submittedCount: 10,
        defaulterCount: 0,
        defaulters: [],
      };

      render(
        <DefaultersPanel
          report={fullComplianceReport}
          loading={false}
          onRefresh={jest.fn()}
          onSendAlert={jest.fn()}
          isDispatching={false}
        />
      );

      expect(screen.getByText(/100% Submission Compliance/i)).toBeInTheDocument();
    });

    it("triggers callbacks on button clicks and week selector changes", () => {
      const onRefresh = jest.fn();
      const onSendAlert = jest.fn();
      const onWeekChange = jest.fn();

      render(
        <DefaultersPanel
          report={mockReport}
          loading={false}
          onRefresh={onRefresh}
          onSendAlert={onSendAlert}
          isDispatching={false}
          selectedWeek="Week 3"
          onWeekChange={onWeekChange}
        />
      );

      const refreshBtn = screen.getByRole("button", { name: /Refresh Defaulters/i });
      fireEvent.click(refreshBtn);
      expect(onRefresh).toHaveBeenCalledTimes(1);

      const dispatchBtn = screen.getByRole("button", { name: /Dispatch (WhatsApp|Telegram) Alert/i });
      fireEvent.click(dispatchBtn);
      expect(onSendAlert).toHaveBeenCalledTimes(1);

      const select = screen.getByRole("combobox");
      fireEvent.change(select, { target: { value: "Week 4" } });
      expect(onWeekChange).toHaveBeenCalledWith("Week 4");
    });
  });
});
