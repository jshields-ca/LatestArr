import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";

import { AuthCard } from "./auth-card";

describe("AuthCard", () => {
  it("is the page's main area, with the title as its heading and the browser tab's name", () => {
    render(
      <AuthCard title="Reset your password" description="Enter your email.">
        <button type="button">Send link</button>
      </AuthCard>,
    );
    const main = screen.getByRole("main");
    expect(main).toContainElement(screen.getByRole("heading", { level: 1, name: "Reset your password" }));
    expect(main).toContainElement(screen.getByRole("button", { name: "Send link" }));
    expect(screen.getByText("Enter your email.")).toBeInTheDocument();
    expect(document.title).toBe("Reset your password · LatestArr");
  });

  it("keeps a hidden title as the heading for screen readers", () => {
    render(
      <AuthCard title="Sign in" titleHidden description="Sign in to manage your newsletters.">
        <p>form</p>
      </AuthCard>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Sign in" })).toHaveClass("sr-only");
  });

  it("presses the stamp only where asked, and always shows it at its tilt", () => {
    const { container, rerender } = render(
      <AuthCard title="Sign in" description="x" animate>
        <p>form</p>
      </AuthCard>,
    );
    const stamp = () => screen.getByRole("img", { name: "LatestArr" });
    expect(stamp()).toHaveClass("stamp-tilt", "stamp-press");
    // The postmark is decoration.
    expect(container.querySelector("svg[aria-hidden='true']")).toHaveClass("postmark-in");

    rerender(
      <AuthCard title="Choose a new password" description="x">
        <p>form</p>
      </AuthCard>,
    );
    expect(stamp()).toHaveClass("stamp-tilt");
    expect(stamp()).not.toHaveClass("stamp-press");
    expect(container.querySelector("svg[aria-hidden='true']")).not.toHaveClass("postmark-in");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <AuthCard title="Sign in" titleHidden description="Sign in to manage your newsletters." animate>
        <label>
          Email <input type="email" />
        </label>
      </AuthCard>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
