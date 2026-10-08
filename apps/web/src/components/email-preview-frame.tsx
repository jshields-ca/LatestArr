import { Moon, Sun } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  type PreviewScheme,
  readStoredPreviewScheme,
  withPreviewScheme,
  writeStoredPreviewScheme,
} from "@/lib/email-preview";
import { cn } from "@/lib/utils";

const SCHEMES: { value: PreviewScheme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

/** The preview's Light / Dark choice, remembered in this browser. */
export function usePreviewScheme() {
  const [scheme, setScheme] = useState<PreviewScheme>(readStoredPreviewScheme);
  const choose = (next: PreviewScheme) => {
    setScheme(next);
    writeStoredPreviewScheme(next);
  };
  return [scheme, choose] as const;
}

export function PreviewSchemeToggle({
  scheme,
  onChange,
}: {
  scheme: PreviewScheme;
  onChange: (scheme: PreviewScheme) => void;
}) {
  return (
    <div role="group" aria-label="Preview as" className="inline-flex rounded-md border border-input p-0.5">
      {SCHEMES.map(({ value, label, Icon }) => (
        <Button
          key={value}
          type="button"
          size="sm"
          variant={scheme === value ? "secondary" : "ghost"}
          aria-pressed={scheme === value}
          onClick={() => onChange(value)}
          className="h-7 px-2"
        >
          <Icon />
          {label}
        </Button>
      ))}
    </div>
  );
}

/**
 * An email shown in a sandboxed iframe, as an email app in light or dark
 * mode would show it. No scripts or same-origin access; popups are allowed
 * so the email's own links open in a new tab.
 */
export function EmailPreviewFrame({
  title,
  html,
  scheme,
  className,
}: {
  title: string;
  html: string;
  scheme: PreviewScheme;
  className?: string;
}) {
  return (
    <iframe
      title={title}
      srcDoc={withPreviewScheme(html, scheme)}
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      // Also sets the browser's own defaults (scrollbars, unstyled areas)
      // to match.
      style={{ colorScheme: scheme }}
      className={cn("w-full rounded-md border border-border", scheme === "dark" ? "bg-black" : "bg-white", className)}
    />
  );
}
