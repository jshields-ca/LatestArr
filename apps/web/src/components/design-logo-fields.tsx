import { useId, useRef, useState } from "react";
import { ImageUp, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ApiError, designImageUrl, MAX_DESIGN_IMAGE_BYTES, uploadDesignImage } from "@/lib/api";
import { type DesignLogo, type DesignTextAlign, LOGO_MAX_WIDTH, LOGO_MIN_WIDTH, logoProblem } from "@/lib/design";
import { cn } from "@/lib/utils";

const SOURCES: { value: DesignLogo["source"]; label: string }[] = [
  { value: "none", label: "No logo" },
  { value: "upload", label: "Upload an image" },
  { value: "url", label: "Image URL" },
];

const ALIGNS: { value: DesignTextAlign; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "center", label: "Centre" },
  { value: "right", label: "Right" },
];

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/gif"];

// Checked here so a wrong file says why straight away; the server checks
// the contents again either way.
function fileProblem(file: File): string | null {
  if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) {
    return "SVG images aren't supported, because most email clients don't show them. Save it as a PNG instead.";
  }
  if (file.type && !ACCEPTED_TYPES.includes(file.type)) return "Use a PNG, JPEG or GIF image.";
  if (file.size > MAX_DESIGN_IMAGE_BYTES) return "Images can be up to 1 MB. Try a smaller or more compressed version.";
  return null;
}

// One uploaded image: a thumbnail with Replace and Remove, or an Upload
// button. The thumbnail sits on the kind of background the image is for,
// so a dark logo on a transparent background stays visible.
function ImageUpload({
  label,
  imageId,
  surface,
  onChange,
}: {
  label: string;
  imageId: string | null;
  surface: "light" | "dark";
  onChange: (imageId: string | null) => void;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const problem = fileProblem(file);
    if (problem) {
      setError(problem);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const { image } = await uploadDesignImage(file);
      onChange(image.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't upload the image.");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        {imageId ? (
          <img
            src={designImageUrl(imageId)}
            alt=""
            className={cn(
              "h-12 max-w-40 rounded border border-border bg-[length:12px_12px] object-contain p-1",
              surface === "light"
                ? "bg-white bg-[repeating-conic-gradient(#0000000d_0_25%,transparent_0_50%)]"
                : "bg-neutral-900 bg-[repeating-conic-gradient(#ffffff12_0_25%,transparent_0_50%)]",
            )}
          />
        ) : null}
        <input
          ref={input}
          id={inputId}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="sr-only"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => input.current?.click()}>
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />}
          {imageId ? "Replace" : "Upload"}
        </Button>
        {imageId ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)} aria-label={`Remove ${label.toLowerCase()}`}>
            <Trash2 className="size-4" />
            Remove
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function UrlField({
  id,
  label,
  value,
  placeholder,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  value: string | null;
  placeholder: string;
  hint?: string;
  onChange: (value: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="url"
        inputMode="url"
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value.trim() ? e.target.value.trim() : null)}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

// The design's logo (#302). `showLayout` is off for a code design, which
// places {{logo}} itself.
export function DesignLogoFields({
  logo,
  showLayout,
  onChange,
}: {
  logo: DesignLogo;
  showLayout: boolean;
  onChange: (logo: DesignLogo) => void;
}) {
  const set = <K extends keyof DesignLogo>(key: K, value: DesignLogo[K]) => onChange({ ...logo, [key]: value });
  const problem = logoProblem(logo);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="design-logo-source">Logo</Label>
        <Select
          id="design-logo-source"
          value={logo.source}
          onChange={(e) => set("source", e.target.value as DesignLogo["source"])}
        >
          {SOURCES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      {logo.source === "upload" ? (
        <>
          <p className="text-xs text-muted-foreground">
            PNG, JPEG or GIF, up to 1 MB. It's included in each email, so it shows even where images from the web are
            blocked.
          </p>
          <ImageUpload label="Logo image" surface="light" imageId={logo.imageId} onChange={(imageId) => set("imageId", imageId)} />
          <ImageUpload
            label="Dark mode version (optional)"
            surface="dark"
            imageId={logo.darkImageId}
            onChange={(darkImageId) => set("darkImageId", darkImageId)}
          />
        </>
      ) : null}

      {logo.source === "url" ? (
        <>
          <UrlField
            id="design-logo-url"
            label="Image URL"
            placeholder="https://example.com/logo.png"
            value={logo.url}
            onChange={(url) => set("url", url)}
          />
          <UrlField
            id="design-logo-dark-url"
            label="Dark mode version (optional)"
            placeholder="https://example.com/logo-dark.png"
            value={logo.darkUrl}
            onChange={(darkUrl) => set("darkUrl", darkUrl)}
          />
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-sm font-medium">When sending</legend>
            {(
              [
                { value: "embed", label: "Include a copy in each email (recommended)", hint: "Shows even where images from the web are blocked." },
                { value: "link", label: "Link to it", hint: "A smaller email, and you can change the image without editing the design, but some email apps only show it after Load images." },
              ] as const
            ).map((option) => (
              <label key={option.value} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="design-logo-url-mode"
                  value={option.value}
                  checked={logo.urlMode === option.value}
                  onChange={() => set("urlMode", option.value)}
                  className="mt-1"
                />
                <span>
                  {option.label}
                  <span className="block text-xs text-muted-foreground">{option.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </>
      ) : null}

      {logo.source !== "none" ? (
        <>
          <p className="text-xs text-muted-foreground">
            A dark mode version helps a logo with dark lettering on a transparent background, which disappears on dark
            backgrounds. Switch the preview to Dark to check.
          </p>
          <UrlField
            id="design-logo-link"
            label="Link to (optional)"
            placeholder="https://plex.example.com"
            hint="Where clicking the logo goes, e.g. your server's site or Overseerr."
            value={logo.link}
            onChange={(link) => set("link", link)}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="design-logo-alt">Alt text</Label>
            <Input
              id="design-logo-alt"
              maxLength={120}
              placeholder="The newsletter's name"
              value={logo.alt}
              onChange={(e) => set("alt", e.target.value)}
              aria-describedby="design-logo-alt-hint"
            />
            <p id="design-logo-alt-hint" className="text-xs text-muted-foreground">
              Shown when images are off, and read out by screen readers.
            </p>
          </div>
          {showLayout ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="design-logo-placement">Placement</Label>
                  <Select
                    id="design-logo-placement"
                    value={logo.placement}
                    onChange={(e) => set("placement", e.target.value as DesignLogo["placement"])}
                  >
                    <option value="above">Above the name</option>
                    <option value="replace">Replace the name</option>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="design-logo-align">Alignment</Label>
                  <Select
                    id="design-logo-align"
                    value={logo.align}
                    onChange={(e) => set("align", e.target.value as DesignTextAlign)}
                  >
                    {ALIGNS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="design-logo-width">Maximum width</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">{logo.maxWidth} px</span>
                </div>
                <input
                  id="design-logo-width"
                  type="range"
                  min={LOGO_MIN_WIDTH}
                  max={LOGO_MAX_WIDTH}
                  step={10}
                  value={logo.maxWidth}
                  onChange={(e) => set("maxWidth", Number(e.target.value))}
                  className="accent-primary"
                />
                <p className="text-xs text-muted-foreground">Never wider than the image itself. It shrinks to fit on phones.</p>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              A code design places the logo where it uses {"{{logo}}"}.
            </p>
          )}
        </>
      ) : null}

      {problem ? (
        <p role="alert" className="text-xs text-destructive">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
