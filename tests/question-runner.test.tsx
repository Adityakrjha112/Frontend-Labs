// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QuestionRunner } from "@/components/QuestionRunner";
import { parseQuestionBank } from "@/importer/validate";
import type { SessionAnswer } from "@/lib/session";
import { BASE_ROWS, makeWorkbook } from "./fixtures/workbook";

afterEach(cleanup);

const [mcq, output, conceptual] = parseQuestionBank(makeWorkbook()).questions;

function setup(q = mcq!, answer?: SessionAnswer) {
  const onAnswer = vi.fn();
  const onVerdict = vi.fn();
  const utils = render(
    <QuestionRunner question={q} answer={answer} timerEnabled={false} onAnswer={onAnswer} onVerdict={onVerdict} positionLabel="Question 1 of 1" />,
  );
  return { ...utils, onAnswer, onVerdict };
}

describe("QuestionRunner", () => {
  it("renders workbook text as plain text, never as HTML", () => {
    const evil = parseQuestionBank(
      makeWorkbook([{ ...BASE_ROWS.conceptual, Question: '<img src=x onerror="alert(1)"> What is <b>this</b>?' }]),
    ).questions[0]!;
    const { container } = setup(evil);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe('<img src=x onerror="alert(1)"> What is <b>this</b>?');
  });

  it("grades an MCQ submission objectively", () => {
    const { onAnswer } = setup();
    const submit = screen.getByRole("button", { name: "Submit answer" });
    expect(submit).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("radio", { name: /Option B/ }));
    fireEvent.click(submit);
    expect(onAnswer).toHaveBeenCalledWith(expect.objectContaining({ kind: "mcq", selected: "B", correct: false }));
  });

  it("supports keyboard option selection", () => {
    setup();
    fireEvent.keyDown(window, { key: "c" });
    expect(screen.getByRole("radio", { name: /Option C/ })).toHaveProperty("checked", true);
  });

  it("requires a written answer before revealing a self-reviewed question", () => {
    const { onAnswer } = setup(conceptual!);
    const reveal = screen.getByRole("button", { name: "Reveal reference answer" });
    expect(reveal).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "It throws at await." } });
    fireEvent.click(reveal);
    expect(onAnswer).toHaveBeenCalledWith(expect.objectContaining({ kind: "self", draft: "It throws at await.", verdict: null }));
  });

  it("labels revealed free-text answers as self-reviewed, not graded", () => {
    const { onVerdict } = setup(output!, { kind: "self", draft: "start\nthen\nend", verdict: null, hintsUsed: 0, seconds: 0 });
    expect(screen.getByText(/was not graded automatically/)).toBeTruthy();
    expect(screen.getByText("Correct answer and expected output")).toBeTruthy();
    expect(screen.getByRole("link", { name: /mozilla\.org documentation/ }).getAttribute("href")).toBe(output!.sourceUrl);
    fireEvent.click(screen.getByRole("button", { name: /Got it/ }));
    expect(onVerdict).toHaveBeenCalledWith("got-it");
  });

  it("reveals hints progressively", () => {
    setup(conceptual!);
    expect(screen.queryByText(conceptual!.hints[0])).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Show hint 1/ }));
    expect(screen.getByText(conceptual!.hints[0])).toBeTruthy();
    expect(screen.queryByText(conceptual!.hints[1])).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Show hint 2/ }));
    expect(screen.getByText(conceptual!.hints[1])).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Show hint/ })).toBeNull();
  });

  it("links the question back to its roadmap week and documentation", () => {
    setup(output!); // ASYNC-002 is mapped to week 6
    const nav = screen.getByRole("navigation", { name: "Related roadmap topics" });
    const links = [...nav.querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href")]);
    expect(links).toEqual([
      ["Week 6: Asynchronous JavaScript and the event loop", "/roadmap/w6"],
      ["Week 6 documentation", "/roadmap/w6#resources"],
    ]);
  });

  it("says when a question has no roadmap week", () => {
    const unmapped = parseQuestionBank(makeWorkbook([{ ...BASE_ROWS.conceptual, ID: "ASYNC-099" }])).questions[0]!;
    setup(unmapped);
    expect(screen.getByText(/isn.t linked to a roadmap week/)).toBeTruthy();
  });
});

describe("CodeBlock", () => {
  it("renders highlighted tokens without Prism class names that clash with app styles", async () => {
    const { CodeBlock } = await import("@/components/CodeBlock");
    const { container } = render(<CodeBlock code={'<input type="checkbox" name="subscribe">'} language="markup" label="Code" />);
    const code = container.querySelector("code")!;
    expect(code.textContent).toContain('<input type="checkbox" name="subscribe">');
    expect(code.querySelectorAll(".tag, .token")).toHaveLength(0);
    // Tokens are still coloured via inline styles.
    expect([...code.querySelectorAll("span[style]")].some((s) => (s as HTMLElement).style.color)).toBe(true);
  });
});

describe("Switch", () => {
  it("is a labelled switch that toggles and states its value in text", async () => {
    const { Switch } = await import("@/components/ui");
    const onChange = vi.fn();
    const { rerender } = render(<Switch label="Timer" checked={false} onChange={onChange} />);
    const sw = screen.getByRole("switch", { name: /Timer/ });
    expect(sw).toHaveProperty("checked", false);
    expect(screen.getByText("Off")).toBeTruthy();
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
    rerender(<Switch label="Timer" checked onChange={onChange} />);
    expect(screen.getByRole("switch", { name: /Timer/ })).toHaveProperty("checked", true);
    expect(screen.getByText("On")).toBeTruthy();
  });
});

describe("TutorPrompt", () => {
  it("copies a week-specific prompt and can leave progress out", async () => {
    const { TutorPrompt } = await import("@/components/roadmap/TutorPrompt");
    const { TOPIC_BY_ID } = await import("@/roadmap/model");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<TutorPrompt topic={TOPIC_BY_ID.get("w6")!} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy prompt" }));
    await screen.findByText(/^Copied \(/);
    const copied = writeText.mock.calls[0]![0] as string;
    expect(copied).toContain('week 6 of 26 of my roadmap: "Asynchronous JavaScript and the event loop"');
    expect(copied).toContain("Where I am this week");
    fireEvent.click(screen.getByLabelText(/Include my progress/));
    fireEvent.click(screen.getByRole("button", { name: "Copy prompt" }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    expect(writeText.mock.calls[1]![0]).not.toContain("Where I am this week");
  });
});
