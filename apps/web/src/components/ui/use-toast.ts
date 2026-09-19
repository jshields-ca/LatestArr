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
// that leaves dismissed toasts in the DOM for over 16 minutes). Toasts
// here are removed from state the moment Radix reports them closed
// (whether by the auto-dismiss timer, a manual close, or a swipe), so
// there's no separate removal timer to get wrong.
export type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

const TOAST_LIMIT = 4;
const DEFAULT_DURATION = 6000;

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

let toasts: ToasterToast[] = [];
type Listener = (toasts: ToasterToast[]) => void;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(toasts);
}

function dismiss(toastId: string) {
  toasts = toasts.filter((t) => t.id !== toastId);
  emit();
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

export { toast, useToast };
