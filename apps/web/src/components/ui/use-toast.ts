import * as React from "react";

import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

// A small module-level store rather than Context — `toast()` needs to be
// callable from plain async handlers deep in each page (after an API call
// resolves), not just from inside a component that's wrapped in a
// provider. <Toaster/> (mounted once near the app root) and any number of
// callers both read/write this same module-scoped state, the same shape
// React Router's own outside-of-render APIs use.
//
// Deliberately not shadcn/ui's usual reducer-plus-setTimeout `use-toast`
// (its default REMOVE_DELAY is 1000000ms — a long-standing upstream bug
// that leaves dismissed toasts in the DOM for over 16 minutes). This is
// still a two-phase dismiss — Radix's exit animation needs `open` to flip
// to `false` and the toast to stay mounted while it plays; removing it
// from the array immediately would unmount it before `data-state=
// "closed"` ever applied, so the animate-out classes in toast.tsx would
// never run — but REMOVE_DELAY here is short and actually matches the
// CSS: the longest exit animation toast.tsx uses (tw-animate-css's
// default) runs 150ms, so 300ms comfortably covers it without leaving a
// closed toast lingering the way shadcn's default does.
export type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

const TOAST_LIMIT = 4;
const DEFAULT_DURATION = 6000;
const REMOVE_DELAY = 300;

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

let toasts: ToasterToast[] = [];
type Listener = (toasts: ToasterToast[]) => void;
const listeners = new Set<Listener>();
const removeTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  for (const listener of listeners) listener(toasts);
}

function remove(toastId: string) {
  removeTimeouts.delete(toastId);
  toasts = toasts.filter((t) => t.id !== toastId);
  emit();
}

// Phase 1 of dismiss: flip `open` to false so <Toast>'s Radix Root sees
// data-state="closed" and runs its exit animation while still mounted.
// Phase 2 (remove, above) drops it from state once that animation has
// had time to finish. Safe to call more than once for the same id (a
// swipe-then-onOpenChange path and a manual Close click can both reach
// here) — an already-scheduled removal is just left to fire once.
function dismiss(toastId: string) {
  toasts = toasts.map((t) => (t.id === toastId ? { ...t, open: false } : t));
  emit();

  if (!removeTimeouts.has(toastId)) {
    removeTimeouts.set(
      toastId,
      setTimeout(() => remove(toastId), REMOVE_DELAY),
    );
  }
}

export type Toast = Omit<ToasterToast, "id">;

function toast({ duration = DEFAULT_DURATION, ...props }: Toast) {
  const id = genId();

  const update = (next: Toast) =>
    (toasts = toasts.map((t) => (t.id === id ? { ...t, ...next, id } : t)));

  toasts = [{ ...props, id, duration, open: true }, ...toasts].slice(0, TOAST_LIMIT);
  emit();

  return {
    id,
    dismiss: () => dismiss(id),
    update: (next: Toast) => {
      update(next);
      emit();
    },
  };
}

function useToast() {
  const [state, setState] = React.useState(toasts);

  React.useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return { toasts: state, toast, dismiss };
}

export { toast, useToast, DEFAULT_DURATION };
