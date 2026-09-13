import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it } from "vitest";

import { DashboardPage } from "./dashboard-page";

describe("DashboardPage", () => {
  it("renders the example settings row", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Example: newsletter schedule")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<DashboardPage />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
