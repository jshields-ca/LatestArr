import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";

import { ConfirmHost } from "./confirm-dialog";
import { ConfirmDeleteButton, ListRow } from "./list-row";

describe("ListRow", () => {
  it("renders a leading icon, primary text, secondary metadata, and actions as a static row", () => {
    render(
      <ListRow
        leading={<span data-testid="leading">icon</span>}
        primary={<p className="truncate font-medium">Home Tautulli</p>}
        secondary={<p className="text-sm text-muted-foreground">http://localhost:8181</p>}
        actions={<button type="button">Edit Home Tautulli</button>}
      />,
    );

    expect(screen.getByTestId("leading")).toBeInTheDocument();
    expect(screen.getByText("Home Tautulli")).toBeInTheDocument();
    expect(screen.getByText("http://localhost:8181")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Home Tautulli" })).toBeInTheDocument();
    // A static row (no `expand`) never renders a toggle button of its own.
    expect(screen.queryByRole("button", { name: "Home Tautulli" })).not.toBeInTheDocument();
  });

  it("omits the actions cluster entirely when no actions are given", () => {
    const { container } = render(<ListRow primary={<p>Alice</p>} />);
    expect(container.querySelectorAll(".shrink-0.items-center.gap-2").length).toBe(0);
  });

  it("renders extra content below the row via children", () => {
    render(
      <ListRow primary={<p>Primary</p>} actions={<button type="button">Edit</button>}>
        <p>Nested detail content</p>
      </ListRow>,
    );

    expect(screen.getByText("Nested detail content")).toBeInTheDocument();
  });

  it("wraps the row in a toggle button with a chevron when `expand` is given, and its accessible name includes both primary and secondary text", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <ListRow
        primary={<span className="truncate font-medium">Weekly digest</span>}
        secondary={<span className="text-sm text-muted-foreground">7-day lookback</span>}
        expand={{ expanded: false, onToggle }}
        actions={<button type="button">Edit Weekly digest</button>}
      />,
    );

    const toggle = screen.getByRole("button", { name: /Weekly digest.*lookback/, expanded: false });
    await user.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);

    // The Edit button in `actions` is a separate control from the toggle.
    expect(screen.getByRole("button", { name: "Edit Weekly digest" })).toBeInTheDocument();
  });

  it("reflects `expand.expanded` in aria-expanded", () => {
    render(
      <ListRow
        primary={<span>Everyone</span>}
        expand={{ expanded: true, onToggle: vi.fn() }}
      />,
    );

    expect(screen.getByRole("button", { name: "Everyone", expanded: true })).toBeInTheDocument();
  });

  it("has no accessibility violations for a static row or an expandable one", async () => {
    const { container } = render(
      <>
        <ListRow
          leading={<span aria-hidden="true">icon</span>}
          primary={<p className="truncate font-medium">Primary</p>}
          secondary={<p className="text-sm text-muted-foreground">Secondary</p>}
          actions={<button type="button">Edit Primary</button>}
        />
        <ListRow
          primary={<span>Everyone</span>}
          expand={{ expanded: false, onToggle: vi.fn() }}
          actions={<button type="button">Edit Everyone</button>}
        />
      </>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("ConfirmDeleteButton", () => {
  function renderButton(props: Partial<Parameters<typeof ConfirmDeleteButton>[0]> = {}) {
    const onConfirm = props.onConfirm ?? vi.fn().mockResolvedValue(undefined);
    render(
      <>
        <ConfirmDeleteButton label="Delete Alice" noun="recipient" {...props} onConfirm={onConfirm} />
        <ConfirmHost />
      </>,
    );
    return onConfirm;
  }

  it("asks in a dialog that names the thing, and Cancel leaves it alone", async () => {
    const user = userEvent.setup();
    const onConfirm = renderButton();

    await user.click(screen.getByRole("button", { name: "Delete Alice" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete Alice?" });
    // With nothing else to say, it says the delete is final.
    expect(dialog).toHaveTextContent("This can't be undone.");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Delete Alice" })).toBeEnabled();
    expect(onConfirm).not.toHaveBeenCalled();
    // Keyboard users are put back where they were.
    await waitFor(() => expect(screen.getByRole("button", { name: "Delete Alice" })).toHaveFocus());
  });

  it("says what goes with it, and its confirm button names the action", async () => {
    const user = userEvent.setup();
    const onConfirm = renderButton({ label: "Delete Home Plex", noun: "source", consequence: "Newsletters that use it will stop including its items." });

    await user.click(screen.getByRole("button", { name: "Delete Home Plex" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete Home Plex?" });
    expect(dialog).toHaveTextContent("Newsletters that use it will stop including its items.");
    expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete source" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });

  it("deletes once confirmed, and is disabled while the delete is in flight", async () => {
    const user = userEvent.setup();
    let resolveDelete!: () => void;
    const onConfirm = renderButton({
      onConfirm: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveDelete = resolve;
          }),
      ),
    });

    await user.click(screen.getByRole("button", { name: "Delete Alice" }));
    await user.click(await screen.findByRole("button", { name: "Delete recipient" }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Delete Alice" })).toBeDisabled();

    resolveDelete();
    // Still on screen only when the delete failed, so it's usable again.
    await waitFor(() => expect(screen.getByRole("button", { name: "Delete Alice" })).toBeEnabled());
  });
});
