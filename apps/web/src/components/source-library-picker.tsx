import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ApiError, listSourceLibraries, type SourceLibrary } from "@/lib/api";
import { cn } from "@/lib/utils";

// Which of a linked source's libraries a newsletter reads (#483): all of
// them, including ones added later, or only the ticked ones, so a private
// library (a 4K copy, or one kept to yourself) never reaches recipients.

type Mode = "all" | "only";

export function librariesSummary(libraryFilter: string[] | null): string {
  if (!libraryFilter || libraryFilter.length === 0) return "All libraries";
  return libraryFilter.length === 1 ? "Only 1 library" : `Only ${libraryFilter.length} libraries`;
}

export function SourceLibraryPicker({
  sourceId,
  sourceName,
  libraryFilter,
  sharesServerWith = [],
  disabled,
  onSave,
}: {
  sourceId: string;
  sourceName: string;
  libraryFilter: string[] | null;
  /** Linked sources that may read the same server (Plex and its Tautulli). */
  sharesServerWith?: string[];
  disabled?: boolean;
  /** Saves the choice; throws to keep the panel open with the error. */
  onSave: (libraryFilter: string[] | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [libraries, setLibraries] = useState<SourceLibrary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("all");
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function load() {
    setLibraries(null);
    setLoadError(null);
    try {
      setLibraries(await listSourceLibraries(sourceId));
    } catch (err) {
      setLoadError(`Couldn't get ${sourceName}'s libraries${err instanceof ApiError ? `: ${err.message}` : "."}`);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    // Start from what's saved, each time it opens.
    const only = Boolean(libraryFilter && libraryFilter.length > 0);
    setMode(only ? "only" : "all");
    setTicked(new Set(only ? libraryFilter : []));
    setSaveError(null);
    void load();
  }

  function toggle(id: string) {
    setTicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Only libraries the source still has: one removed since can't be read.
  const chosen = libraries ? libraries.filter((library) => ticked.has(library.id)).map((library) => library.id) : [];
  const nothingTicked = mode === "only" && chosen.length === 0;

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(mode === "all" ? null : chosen);
      setOpen(false);
    } catch (err) {
      setSaveError(`Couldn't save${err instanceof ApiError ? `: ${err.message}` : "."}`);
    } finally {
      setSaving(false);
    }
  }

  const radioName = `libraries-${sourceId}`;

  return (
    <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
      <span>Libraries:</span>
      <span className="text-foreground">{librariesSummary(libraryFilter)}</span>
      <span aria-hidden="true">·</span>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label={`Change which libraries this newsletter reads from ${sourceName}`}
            className="rounded-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            Change
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          aria-label={`Libraries from ${sourceName}`}
          className="flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3"
        >
          <p className="text-sm font-medium">Libraries from {sourceName}</p>
          <fieldset className="flex flex-col gap-2" disabled={saving}>
            <legend className="sr-only">Which libraries this newsletter reads</legend>
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" name={radioName} checked={mode === "all"} onChange={() => setMode("all")} className="mt-1" />
              <span>
                All libraries
                <span className="block text-xs text-muted-foreground">Including ones added later</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" name={radioName} checked={mode === "only"} onChange={() => setMode("only")} className="mt-1" />
              <span>
                Only these
                <span className="block text-xs text-muted-foreground">A library added later stays out until you tick it.</span>
              </span>
            </label>
            <div className="pl-6">
              {loadError ? (
                <div className="flex flex-col items-start gap-2">
                  <p role="alert" className="text-sm text-destructive">
                    {loadError}
                  </p>
                  <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
                    Try again
                  </Button>
                </div>
              ) : !libraries ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Getting libraries...
                </p>
              ) : libraries.length === 0 ? (
                <p className="text-sm text-muted-foreground">{sourceName} has no libraries to choose from.</p>
              ) : (
                <ul
                  aria-label={`${sourceName}'s libraries`}
                  className={cn(
                    "flex max-h-56 flex-col gap-0.5 overflow-y-auto rounded-md border border-border p-1.5",
                    mode === "all" && "opacity-60",
                  )}
                >
                  {libraries.map((library) => {
                    const id = `library-${sourceId}-${library.id}`;
                    return (
                      <li key={library.id} className="flex items-center gap-2 rounded px-1.5 py-1">
                        <input
                          type="checkbox"
                          id={id}
                          checked={mode === "all" || ticked.has(library.id)}
                          disabled={mode === "all"}
                          onChange={() => toggle(library.id)}
                          className="size-4 shrink-0 accent-primary disabled:opacity-50"
                        />
                        <label htmlFor={id} className="min-w-0 flex-1 truncate text-sm">
                          {library.name}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </fieldset>
          {sharesServerWith.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              If {sharesServerWith.join(" or ")} reads the same server, only libraries chosen on both are read, there
              and here.
            </p>
          ) : null}
          {nothingTicked && libraries && libraries.length > 0 ? (
            <p className="text-xs text-muted-foreground">Tick at least one library, or choose All libraries.</p>
          ) : null}
          {saveError ? (
            <p role="alert" className="text-sm text-destructive">
              {saveError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSave()}
              disabled={saving || (mode === "only" && (!libraries || nothingTicked))}
            >
              {saving ? <Loader2 className="animate-spin" /> : null}
              Save
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
