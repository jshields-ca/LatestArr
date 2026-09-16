import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 [&>span]:text-left",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="size-4 shrink-0 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <ChevronUp className="size-4" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <ChevronDown className="size-4" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        "relative z-50 max-h-[min(24rem,var(--radix-select-content-available-height))] min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className,
      )}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex size-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="size-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

// The Radix building blocks above are exported for anything that wants the
// full, explicit composition (Select/SelectTrigger/SelectValue/
// SelectContent/SelectItem), matching the standard shadcn/ui Select.
const SelectRoot = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;
const SelectLabel = SelectPrimitive.Label;
const SelectSeparator = SelectPrimitive.Separator;

// --- Compatibility shim -----------------------------------------------
//
// Every call site in this app still uses the old native-<select> shape
// this component used to wrap directly: `value`/`onChange` (with
// `onChange`'s event carrying `target.value`), a `disabled` flag, and
// plain `<option value=...>Label</option>` children. Rebuilding those
// call sites for Radix's real API (`value`/`onValueChange`,
// `<SelectItem>` children) would mean touching every page that renders a
// dropdown, so instead this default export adapts the old props shape
// onto the real Radix-based dropdown above, entirely internally.
//
// Radix reserves the empty string as its own internal "nothing selected"
// sentinel, so a literal `<option value="">` (used for "None yet" /
// "Select a source..." placeholders throughout this app) can't be passed
// through as-is — it's swapped for an internal sentinel value and
// translated back at both props (in) and onChange (out).
const EMPTY_VALUE_SENTINEL = "__select_empty__";

function toInternalValue(value: string): string {
  return value === "" ? EMPTY_VALUE_SENTINEL : value;
}

function toExternalValue(value: string): string {
  return value === EMPTY_VALUE_SENTINEL ? "" : value;
}

interface ParsedOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

function parseOptionChildren(children: React.ReactNode): ParsedOption[] {
  const options: ParsedOption[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const props = child.props as {
      value?: string | number | readonly string[];
      children?: React.ReactNode;
      disabled?: boolean;
    };
    options.push({
      value: toInternalValue(String(props.value ?? "")),
      label: props.children,
      disabled: props.disabled,
    });
  });
  return options;
}

export interface SelectProps {
  className?: string;
  children?: React.ReactNode;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  value?: string | number | readonly string[];
  defaultValue?: string | number | readonly string[];
  "aria-label"?: string;
  /** Synthesizes a native-style `{ target: { value } }` event, like the
   *  native `<select>` this component used to render directly. */
  onChange?: (event: { target: { value: string } }) => void;
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      className,
      children,
      id,
      name,
      value,
      defaultValue,
      onChange,
      disabled,
      required,
      "aria-label": ariaLabel,
    },
    ref,
  ) => {
    const options = React.useMemo(() => parseOptionChildren(children), [children]);

    return (
      <SelectRoot
        value={value !== undefined ? toInternalValue(String(value)) : undefined}
        defaultValue={defaultValue !== undefined ? toInternalValue(String(defaultValue)) : undefined}
        onValueChange={(next) => onChange?.({ target: { value: toExternalValue(next) } })}
        disabled={disabled}
        name={name}
        required={required}
      >
        <SelectTrigger id={id} ref={ref} className={className} aria-label={ariaLabel}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </SelectRoot>
    );
  },
);
Select.displayName = "Select";

export {
  Select,
  SelectRoot,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
