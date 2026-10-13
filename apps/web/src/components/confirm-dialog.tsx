import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// A styled stand-in for window.confirm. confirmAction() opens it and
// resolves true for the confirm button, false for Cancel, Escape, or a
// click outside. Like toasts, a module-level store feeds one <ConfirmHost />
// mounted near the app root; without one mounted (some tests), a confirm
// stays unanswered, which acts like Cancel.

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** For actions that remove or discard something. */
  destructive?: boolean;
}

interface Pending extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

let current: Pending | null = null;
const listeners = new Set<(pending: Pending | null) => void>();

function publish(next: Pending | null) {
  current = next;
  listeners.forEach((listener) => listener(next));
}

/** Asks in a styled dialog; true when the user confirms. */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  // A newer question replaces an unanswered one, which counts as Cancel.
  current?.resolve(false);
  return new Promise((resolve) => publish({ ...options, resolve }));
}

function answer(confirmed: boolean) {
  if (!current) return;
  const { resolve } = current;
  publish(null);
  resolve(confirmed);
}

export function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(current);
  useEffect(() => {
    listeners.add(setPending);
    return () => {
      listeners.delete(setPending);
    };
  }, []);

  return (
    <Dialog open={pending !== null} onOpenChange={(open) => (open ? undefined : answer(false))}>
      {pending ? (
        <DialogContent role="alertdialog" className="max-w-sm bg-background">
          <DialogHeader>
            <DialogTitle>{pending.title}</DialogTitle>
            {pending.description ? <DialogDescription>{pending.description}</DialogDescription> : null}
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => answer(false)}>
              {pending.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              type="button"
              variant={pending.destructive ? "destructive" : "default"}
              onClick={() => answer(true)}
            >
              {pending.confirmLabel ?? "OK"}
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
