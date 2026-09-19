import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toast, useToast } from "./use-toast";

// use-toast.ts's `toasts` array is module-level shared state (deliberately
// — see its own comment on why this isn't Context), so every test here
// looks up its own toast by id rather than assuming array position or
// length, and none of them need to reset that state between runs.

describe("dismiss", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("flips `open` to false immediately, and only removes the toast from state after the exit-animation delay", () => {
    const { result } = renderHook(() => useToast());

    let id = "";
    act(() => {
      id = toast({ title: "Source added" }).id;
    });

    expect(result.current.toasts.find((t) => t.id === id)).toMatchObject({ open: true });

    // This is the exact regression a straight `filter()` dismiss caused:
    // Radix's exit animation (data-[state=closed]:animate-out in
    // toast.tsx) needs the toast to still be mounted with open: false so
    // Presence can see data-state="closed" — removing it from the array
    // in the same tick unmounts it before that ever applies, so the
    // animation never runs.
    act(() => {
      result.current.dismiss(id);
    });

    const dismissed = result.current.toasts.find((t) => t.id === id);
    expect(dismissed).toBeDefined();
    expect(dismissed?.open).toBe(false);

    // Not yet removed — still well inside the removal delay.
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.toasts.find((t) => t.id === id)).toBeDefined();

    // The removal delay (300ms) comfortably covers the longest exit
    // animation toast.tsx uses (tw-animate-css's 150ms default) without
    // leaving a closed toast around for anywhere near shadcn's own
    // broken 1,000,000ms default.
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.toasts.find((t) => t.id === id)).toBeUndefined();
  });

  it("tolerates being called more than once for the same id (e.g. a swipe followed by onOpenChange)", () => {
    const { result } = renderHook(() => useToast());

    let id = "";
    act(() => {
      id = toast({ title: "Recipient deleted" }).id;
    });

    act(() => {
      result.current.dismiss(id);
      result.current.dismiss(id);
    });
    expect(result.current.toasts.find((t) => t.id === id)?.open).toBe(false);

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.toasts.find((t) => t.id === id)).toBeUndefined();
  });
});
