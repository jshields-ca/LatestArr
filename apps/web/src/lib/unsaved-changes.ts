import { useEffect, useId, useRef, useState } from "react";

// How the app treats unsaved changes (#295). Forms with a Save button
// register while they have changes, so leaving the page, following a link
// in the sidebar, closing a dialog or collapsing a panel can ask first.
// See CONTRIBUTING.md, "Saving".

export const DISCARD_MESSAGE = "You have unsaved changes. Discard them?";

// Which mounted forms have unsaved changes. Module-level rather than a
// context, so any component can check it without a provider.
const dirtyForms = new Set<string>();

export function hasUnsavedChanges(): boolean {
  return dirtyForms.size > 0;
}

/** True when there's nothing unsaved, or the user agrees to discard it. */
export function confirmDiscard(dirty = hasUnsavedChanges()): boolean {
  return !dirty || window.confirm(DISCARD_MESSAGE);
}

/**
 * Registers a form's unsaved changes while `dirty`, and has the browser
 * ask before the page is reloaded or closed.
 */
export function useUnsavedChanges(dirty: boolean): void {
  const id = useId();
  useEffect(() => {
    if (!dirty) return;
    dirtyForms.add(id);
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => {
      dirtyForms.delete(id);
      window.removeEventListener("beforeunload", warn);
    };
  }, [dirty, id]);
}

/**
 * Whether a form's values differ from when they were last saved. The
 * snapshot is taken from `current` once `ready` (the saved values are
 * loaded, and any blanks filled with suggestions), and again on the render
 * after `markSaved()`, so whatever the save response changed counts as
 * saved too. `current` is compared as JSON.
 */
export function useSavedSnapshot(current: unknown, ready = true): { dirty: boolean; markSaved: () => void } {
  const json = JSON.stringify(current);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  useEffect(() => {
    if (ready && snapshot === null) setSnapshot(json);
  }, [ready, snapshot, json]);
  return { dirty: snapshot !== null && json !== snapshot, markSaved: () => setSnapshot(null) };
}

/** A dialog's onOpenChange that asks before closing with unsaved changes. */
export function guardClose(dirty: boolean, onOpenChange: (open: boolean) => void): (open: boolean) => void {
  return (open) => {
    if (!open && !confirmDiscard(dirty)) return;
    onOpenChange(open);
  };
}

function isSaveShortcut(event: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): boolean {
  return (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "s";
}

/**
 * A form's ref: Ctrl/Cmd+S inside it submits it, as its Save button would,
 * and does nothing while that button is disabled (no changes, or saving).
 * A ref rather than onKeyDown, which a <form> can't take without upsetting
 * the accessibility lint; React calls the returned cleanup on unmount.
 */
export function saveShortcutRef(form: HTMLFormElement | null): (() => void) | undefined {
  if (!form) return undefined;
  const onKeyDown = (event: KeyboardEvent) => {
    if (!isSaveShortcut(event)) return;
    event.preventDefault();
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (button?.disabled) return;
    form.requestSubmit(button ?? undefined);
  };
  form.addEventListener("keydown", onKeyDown);
  return () => form.removeEventListener("keydown", onKeyDown);
}

/**
 * Ctrl/Cmd+S anywhere on the page calls `save` while `enabled`, for a page
 * that is one form (the design editor). The browser's own "Save page" is
 * kept from opening either way.
 */
export function useSaveShortcut(save: () => void, enabled: boolean): void {
  const latest = useRef(save);
  latest.current = save;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isSaveShortcut(event)) return;
      event.preventDefault();
      if (enabled) latest.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
