import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Search } from "lucide-react";

import { matchesSearch } from "@/lib/text";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  /** Shown beside the label, and searched too (an email address, say). */
  detail?: string;
}

// How many matches render at once; typing narrows the rest.
const MAX_SHOWN = 50;

/**
 * A text box that filters a list as you type (the ARIA combobox pattern).
 * Choosing an option, by click or Enter, calls `onSelect` and clears the
 * box but leaves the list open, so several can be picked in a row. Arrow
 * keys move through the list and Escape closes it. Options are shown in
 * the order given.
 */
export function Combobox({
  options,
  onSelect,
  placeholder,
  emptyText = "No matches.",
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  options: ComboboxOption[];
  onSelect: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  "aria-label": string;
}) {
  const id = React.useId();
  const listId = `${id}-list`;
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const matches = React.useMemo(
    () => options.filter((option) => matchesSearch(query, option.label, option.detail)),
    [options, query],
  );
  const shown = matches.slice(0, MAX_SHOWN);
  const activeIndex = Math.min(active, Math.max(shown.length - 1, 0));
  const activeOption = open ? shown[activeIndex] : undefined;

  function choose(option: ComboboxOption) {
    onSelect(option.value);
    setQuery("");
    setActive(0);
    inputRef.current?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) setOpen(true);
        else setActive((index) => Math.min(index + 1, shown.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((index) => Math.max(index - 1, 0));
        break;
      case "Home":
        if (open) setActive(0);
        break;
      case "End":
        if (open) setActive(shown.length - 1);
        break;
      case "Enter":
        if (activeOption) {
          event.preventDefault();
          choose(activeOption);
        }
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
        } else if (query) {
          setQuery("");
        }
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <PopoverPrimitive.Root open={open && !disabled} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div className={cn("relative", className)}>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            role="combobox"
            aria-label={ariaLabel}
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeOption ? `${id}-option-${activeOption.value}` : undefined}
            autoComplete="off"
            placeholder={placeholder}
            value={query}
            disabled={disabled}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            className="flex h-9 w-full rounded-md border border-input bg-background py-1 pl-9 pr-3 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
          />
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          // Focus stays in the text box while the list is open.
          aria-label={ariaLabel}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            if (event.target instanceof Node && inputRef.current?.parentElement?.contains(event.target)) {
              event.preventDefault();
            }
          }}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-56 rounded-md border border-border/80 bg-popover p-1 text-popover-foreground shadow-lg outline-none"
        >
          <ul id={listId} role="listbox" aria-label={ariaLabel} className="max-h-64 overflow-y-auto">
            {shown.map((option, index) => (
              // Keyboard use goes through the text box (arrow keys and Enter,
              // via aria-activedescendant), as the ARIA combobox pattern
              // has it; options never take focus themselves.
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events
              <li
                key={option.value}
                id={`${id}-option-${option.value}`}
                role="option"
                aria-selected={index === activeIndex}
                // Keeps focus in the text box.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
                onMouseMove={() => setActive(index)}
                className={cn(
                  "flex cursor-pointer items-baseline justify-between gap-3 rounded-sm px-2 py-1.5 text-sm",
                  index === activeIndex && "bg-accent text-accent-foreground",
                )}
              >
                <span className="truncate">{option.label}</span>
                {option.detail ? (
                  <span className="truncate text-xs text-muted-foreground">{option.detail}</span>
                ) : null}
              </li>
            ))}
          </ul>
          {shown.length === 0 ? <p className="px-2 py-1.5 text-sm text-muted-foreground">{emptyText}</p> : null}
          {matches.length > shown.length ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              {matches.length - shown.length} more. Type to narrow the list.
            </p>
          ) : null}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
