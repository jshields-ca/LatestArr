import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "@/components/ui/page-header";

import { usePageTitle } from "./page-title";

function Titled({ title }: { title?: string }) {
  usePageTitle(title);
  return null;
}

describe("usePageTitle", () => {
  it("names the tab after the page, and goes back to the app's name when the page goes away", () => {
    const { rerender, unmount } = render(<Titled title="Newsletters" />);
    expect(document.title).toBe("Newsletters · LatestArr");
    rerender(<Titled title="Designs" />);
    expect(document.title).toBe("Designs · LatestArr");
    unmount();
    expect(document.title).toBe("LatestArr");
  });

  it("is just the app's name when there's no title", () => {
    render(<Titled />);
    expect(document.title).toBe("LatestArr");
  });

  it("is set by every page's header", () => {
    render(<PageHeader title="Backups" />);
    expect(document.title).toBe("Backups · LatestArr");
  });
});
