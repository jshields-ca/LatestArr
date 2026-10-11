import { useState } from "react";
import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SaveActions } from "@/components/ui/save-actions";
import {
  confirmDiscard,
  guardClose,
  hasUnsavedChanges,
  saveShortcutRef,
  useSavedSnapshot,
  useUnsavedChanges,
} from "./unsaved-changes";

afterEach(() => vi.restoreAllMocks());

describe("useUnsavedChanges", () => {
  it("registers only while dirty, and warns before the page unloads", () => {
    const { rerender, unmount } = renderHook(({ dirty }) => useUnsavedChanges(dirty), { initialProps: { dirty: false } });
    expect(hasUnsavedChanges()).toBe(false);

    rerender({ dirty: true });
    expect(hasUnsavedChanges()).toBe(true);
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    unmount();
    expect(hasUnsavedChanges()).toBe(false);
  });
});

describe("confirmDiscard and guardClose", () => {
  it("only asks when there's something to lose", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    expect(confirmDiscard(false)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    expect(confirmDiscard(true)).toBe(false);
    expect(confirm).toHaveBeenCalledWith("You have unsaved changes. Discard them?");
  });

  it("keeps a dialog open with unsaved changes unless discarding is confirmed", () => {
    const onOpenChange = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    guardClose(true, onOpenChange)(false);
    expect(onOpenChange).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    guardClose(true, onOpenChange)(false);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    // Opening never asks.
    guardClose(true, onOpenChange)(true);
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
  });
});

describe("useSavedSnapshot", () => {
  it("is dirty after a change, and clean again once marked saved", () => {
    const { result, rerender } = renderHook(({ value }) => useSavedSnapshot({ value }), { initialProps: { value: "a" } });
    expect(result.current.dirty).toBe(false);
    rerender({ value: "b" });
    expect(result.current.dirty).toBe(true);
    result.current.markSaved();
    rerender({ value: "b" });
    expect(result.current.dirty).toBe(false);
  });

  it("waits until the saved values are ready", () => {
    const { result, rerender } = renderHook(({ value, ready }) => useSavedSnapshot({ value }, ready), {
      initialProps: { value: "", ready: false },
    });
    rerender({ value: "loaded", ready: true });
    expect(result.current.dirty).toBe(false);
  });
});

function Form({ onSave }: { onSave: () => void }) {
  const [name, setName] = useState("");
  return (
    <form
      ref={saveShortcutRef}
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <SaveActions dirty={name !== ""} saving={false} />
    </form>
  );
}

describe("saveShortcutRef", () => {
  it("saves with Ctrl+S or Cmd+S, but not while Save is disabled", () => {
    const onSave = vi.fn();
    render(<Form onSave={onSave} />);
    const input = screen.getByLabelText("Name");

    fireEvent.keyDown(input, { key: "s", ctrlKey: true });
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();

    fireEvent.change(input, { target: { value: "Ada" } });
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changes");
    fireEvent.keyDown(input, { key: "s", ctrlKey: true });
    fireEvent.keyDown(input, { key: "S", metaKey: true });
    expect(onSave).toHaveBeenCalledTimes(2);
  });
});
