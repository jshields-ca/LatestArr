import { useRef } from "react";
import { Braces } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MAX_SUBJECT_LENGTH, previewSubject, SUBJECT_VARIABLES, subjectProblem } from "@/lib/subject";

// A newsletter's subject line, with {variables} filled in on each send
// (#267): insert one from the list, see what the next subject would look
// like, and catch a typo before saving.
export function SubjectField({
  id,
  value,
  onChange,
  disabled,
  newsletterName,
  timeZone,
  lookbackDays,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  newsletterName: string;
  timeZone: string;
  lookbackDays: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const problem = subjectProblem(value);
  const preview = problem ? null : previewSubject(value, { name: newsletterName, timeZone, lookbackDays });

  function insert(name: string) {
    const field = input.current;
    const token = `{${name}}`;
    const start = field?.selectionStart ?? value.length;
    const end = field?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end justify-between gap-2">
        <Label htmlFor={id}>Subject (optional)</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-7" disabled={disabled}>
              <Braces className="size-3.5" />
              Insert a variable
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-1" aria-label="Subject variables">
            <ul className="flex flex-col">
              {SUBJECT_VARIABLES.map((variable) => (
                <li key={variable.name}>
                  <button
                    type="button"
                    onClick={() => insert(variable.name)}
                    className="flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  >
                    <code className="text-sm">{`{${variable.name}}`}</code>
                    <span className="text-xs text-muted-foreground">{variable.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      </div>
      <Input
        ref={input}
        id={id}
        placeholder="What's new from {period}"
        value={value}
        maxLength={MAX_SUBJECT_LENGTH + 20}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={problem ? true : undefined}
        aria-describedby={`${id}-hint`}
      />
      <p id={`${id}-hint`} className={problem ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
        {problem ??
          (preview
            ? `Next subject, with example counts: ${preview}`
            : "Blank uses the newsletter's name. Variables like {date} or {count} are filled in on each send.")}
      </p>
    </div>
  );
}
