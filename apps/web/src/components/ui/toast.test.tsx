import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";

import { Toast, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "./toast";

function renderToast(variant: "success" | "sent") {
  return render(
    <ToastProvider>
      <Toast open variant={variant}>
        <ToastTitle>Send started</ToastTitle>
        <ToastDescription>Weekly Digest is being sent.</ToastDescription>
      </Toast>
      <ToastViewport />
    </ToastProvider>,
  );
}

describe("Toast", () => {
  // #332: something mailed gets the stamp and postmark, not the tick.
  it("shows the stamp for something sent, hidden from screen readers", async () => {
    const { container } = renderToast("sent");
    const toast = screen.getByText("Send started").closest("li")!;
    const mark = toast.querySelector('svg[aria-label="LatestArr"]');
    expect(mark).not.toBeNull();
    expect(mark!.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(mark!.getAttribute("class")).toContain("stamp-press-small");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("keeps the tick for other successes", () => {
    renderToast("success");
    const toast = screen.getByText("Send started").closest("li")!;
    expect(toast.querySelector('svg[aria-label="LatestArr"]')).toBeNull();
    // The tick icon is still there.
    expect(toast.querySelector("svg")).not.toBeNull();
  });
});
