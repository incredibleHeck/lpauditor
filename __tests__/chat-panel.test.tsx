import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChatPanel } from "@/components/ChatPanel";
import { toast } from "sonner";

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockChatWithAuditor = jest.fn();
jest.mock("@/app/actions/ai", () => ({
  chatWithAuditor: (...args: any[]) => mockChatWithAuditor(...args),
}));

describe("ChatPanel Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock scrollIntoView for JSDOM
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("renders assistant header and quick prompt buttons when flags are present", () => {
    render(
      <ChatPanel
        submissionId="sub-1"
        flags={["Missing AfL checks", "Pacing too fast"]}
      />
    );

    expect(screen.getByText(/Pedagogical Chat Assistant/i)).toBeInTheDocument();
    expect(screen.getByText(/Resolve: Missing AfL checks/i)).toBeInTheDocument();
    expect(screen.getByText(/Suggest active inquiry starter activities/i)).toBeInTheDocument();
  });

  it("sends message on quick prompt click and renders response", async () => {
    mockChatWithAuditor.mockResolvedValueOnce({
      success: true,
      reply: "Here is how you can introduce AfL checkpoints:\n* **Formative Starter:** Use mini-whiteboards\n* **Peer Assessment:** Swap worksheets",
    });

    render(
      <ChatPanel
        submissionId="sub-1"
        flags={["Missing AfL checks"]}
      />
    );

    const quickBtn = screen.getByText(/Resolve: Missing AfL checks/i);
    fireEvent.click(quickBtn);

    // User message should appear immediately
    expect(screen.getByText(/How specifically can I resolve this compliance flag: "Missing AfL checks"?/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(mockChatWithAuditor).toHaveBeenCalledWith(
        "sub-1",
        [],
        'How specifically can I resolve this compliance flag: "Missing AfL checks"?'
      );
      expect(screen.getByText(/Formative Starter:/i)).toBeInTheDocument();
      expect(screen.getByText(/Use mini-whiteboards/i)).toBeInTheDocument();
    });
  });

  it("submits user question from text input and clears field", async () => {
    mockChatWithAuditor.mockResolvedValueOnce({
      success: true,
      reply: "Differentiate with Concrete-Pictorial-Abstract (CPA) manipulatives.",
    });

    render(<ChatPanel submissionId="sub-2" flags={[]} />);

    const input = screen.getByPlaceholderText(/Ask how to improve this lesson plan/i);
    const sendBtn = screen.getByRole("button", { name: /Send/i });

    fireEvent.change(input, { target: { value: "How do I support EAL learners?" } });
    fireEvent.click(sendBtn);

    expect(input).toHaveValue("");

    await waitFor(() => {
      expect(mockChatWithAuditor).toHaveBeenCalledWith(
        "sub-2",
        [],
        "How do I support EAL learners?"
      );
      expect(screen.getByText(/Concrete-Pictorial-Abstract/i)).toBeInTheDocument();
    });
  });

  it("handles copy advice button click", async () => {
    mockChatWithAuditor.mockResolvedValueOnce({
      success: true,
      reply: "Exemplary active inquiry advice.",
    });

    render(<ChatPanel submissionId="sub-3" flags={[]} />);

    const input = screen.getByPlaceholderText(/Ask how to improve this lesson plan/i);
    fireEvent.change(input, { target: { value: "Give advice" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("Exemplary active inquiry advice.")).toBeInTheDocument();
    });

    const copyBtn = screen.getByRole("button", { name: /Copy advice/i });
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Exemplary active inquiry advice.");
    expect(toast.success).toHaveBeenCalledWith("Advice copied to clipboard!");
  });

  it("displays error banner when AI chat action fails", async () => {
    mockChatWithAuditor.mockResolvedValueOnce({
      success: false,
      error: "AI service quota exceeded",
    });

    render(<ChatPanel submissionId="sub-4" flags={[]} />);

    const input = screen.getByPlaceholderText(/Ask how to improve this lesson plan/i);
    fireEvent.change(input, { target: { value: "Trigger quota error" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(/AI service quota exceeded/i)).toBeInTheDocument();
    });
  });
});
