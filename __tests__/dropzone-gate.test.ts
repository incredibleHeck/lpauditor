import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LessonPlanDropzone from "@/components/LessonPlanDropzone";
import { SCHOOL_SUBJECTS, SCHOOL_CLASSES } from "@/lib/constants";
import { toast } from "sonner";
import { submitLessonPlan } from "@/app/actions/submissions";

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock("@/lib/firebase", () => ({
  auth: {
    currentUser: { uid: "test-teacher-1", email: "teacher@stadelaideschool.com" },
  },
  storage: {},
}));

jest.mock("firebase/storage", () => ({
  ref: jest.fn().mockReturnValue({}),
  uploadBytesResumable: jest.fn(() => ({
    on: jest.fn((_event: string, _prog: any, _err: any, complete: () => void) => {
      complete();
    }),
  })),
  getDownloadURL: jest.fn().mockResolvedValue("https://storage.googleapis.com/test/lesson_plan.pdf"),
}));

jest.mock("@/app/actions/submissions", () => ({
  submitLessonPlan: jest.fn().mockResolvedValue({ success: true }),
}));

describe("Dynamic Dropzone & Upload Validation Suite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Dynamic Subject & Class Filtering per Teacher", () => {
    it("should restrict subject and class options strictly to teacher assignments", () => {
      const assignedSubjects = ["ICT", "Mathematics"];
      const assignedClasses = ["Year 5 (Streams A & B)", "Year 6 (Streams A & B)"];
      const expectedQuotas = [
        { subject: "ICT", className: "Year 5 (Streams A & B)" },
        { subject: "ICT", className: "Year 6 (Streams A & B)" },
        { subject: "Mathematics", className: "Year 5 (Streams A & B)" },
      ];

      render(
        React.createElement(LessonPlanDropzone, {
          teacherId: "test-teacher-1",
          assignedSubjects,
          assignedClasses,
          expectedQuotas,
          isAdmin: false,
        })
      );

      // Verify "Assigned" badges are visible
      expect(screen.getAllByText("Assigned").length).toBeGreaterThanOrEqual(1);

      // Check available subjects in dropdown
      const subjectSelect = screen.getByDisplayValue("ICT");
      const subjectOptions = Array.from((subjectSelect as HTMLSelectElement).options).map(
        (o) => o.value
      );
      expect(subjectOptions).toEqual(["ICT", "Mathematics"]);
      expect(subjectOptions).not.toContain("French");
      expect(subjectOptions).not.toContain("PE");

      // Change subject to Mathematics
      fireEvent.change(subjectSelect, { target: { value: "Mathematics" } });

      // Check available classes for Mathematics
      const classSelect = screen.getByDisplayValue("Year 5 (Streams A & B)");
      const classOptions = Array.from((classSelect as HTMLSelectElement).options).map(
        (o) => o.value
      );
      expect(classOptions).toContain("Year 5 (Streams A & B)");
    });

    it("should allow ADMIN role to override and access All Classes / All Subjects", () => {
      render(
        React.createElement(LessonPlanDropzone, {
          teacherId: "test-admin-1",
          assignedSubjects: ["ICT"],
          assignedClasses: ["Year 1A"],
          isAdmin: true,
        })
      );

      // Admin badge should be displayed
      expect(screen.getAllByText("Admin").length).toBeGreaterThanOrEqual(1);

      // Verify full school catalog is accessible in subject select
      const selects = screen.getAllByRole("combobox");
      const subjectSelect = selects[0] as HTMLSelectElement;
      const subjectOptions = Array.from(subjectSelect.options).map((o) => o.value);

      expect(subjectOptions).toEqual(expect.arrayContaining(Array.from(SCHOOL_SUBJECTS)));
      expect(subjectOptions.length).toBe(SCHOOL_SUBJECTS.length);

      // Verify full class catalog is accessible in class select
      const classSelect = selects[1] as HTMLSelectElement;
      const classOptions = Array.from(classSelect.options).map((o) => o.value);
      expect(classOptions.length).toBe(SCHOOL_CLASSES.length);
    });
  });

  describe("10MB Size Limit & File Extension Validation", () => {
    it("should reject files exceeding the 10MB limit (> 10,485,760 bytes)", async () => {
      render(
        React.createElement(LessonPlanDropzone, {
          teacherId: "test-teacher-1",
          isAdmin: false,
        })
      );

      const dropzoneInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(dropzoneInput).toBeInTheDocument();

      // Create an oversized file: 11 MB = 11 * 1024 * 1024 bytes
      const oversizedBytes = new Uint8Array(11 * 1024 * 1024);
      const oversizedFile = new File([oversizedBytes], "large_curriculum_plan.pdf", {
        type: "application/pdf",
      });

      fireEvent.change(dropzoneInput, {
        target: { files: [oversizedFile] },
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringMatching(/10485760|10 MB/i)
        );
      });
      expect(screen.getByText(/10485760|10 MB/i)).toBeInTheDocument();
      expect(submitLessonPlan).not.toHaveBeenCalled();
    });

    it("should reject invalid file types (e.g. .exe, .txt)", async () => {
      render(
        React.createElement(LessonPlanDropzone, {
          teacherId: "test-teacher-1",
          isAdmin: false,
        })
      );

      const dropzoneInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(dropzoneInput).toBeInTheDocument();

      const invalidFile = new File(["malicious payload"], "script.exe", {
        type: "application/x-msdownload",
      });

      fireEvent.change(dropzoneInput, {
        target: { files: [invalidFile] },
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringMatching(/File rejected/i)
        );
      });
      expect(screen.getByText(/File rejected/i)).toBeInTheDocument();
      expect(submitLessonPlan).not.toHaveBeenCalled();
    });

    it("should accept valid PDF and DOCX files within 10MB limit and queue for audit", async () => {
      render(
        React.createElement(LessonPlanDropzone, {
          teacherId: "test-teacher-1",
          isAdmin: false,
        })
      );

      const dropzoneInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      // Create valid 2MB PDF file
      const validPdf = new File([new Uint8Array(2 * 1024 * 1024)], "lesson_plan.pdf", {
        type: "application/pdf",
      });

      fireEvent.change(dropzoneInput, {
        target: { files: [validPdf] },
      });

      await waitFor(() => {
        expect(submitLessonPlan).toHaveBeenCalled();
      });

      // Verify success notification
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringMatching(/Lesson plan uploaded and queued for audit/i)
      );

      // Verify no size error was triggered
      expect(toast.error).not.toHaveBeenCalled();
    });
  });
});
