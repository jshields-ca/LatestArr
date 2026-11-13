import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  DEFAULT_SECTION_NAMES,
  MAX_SECTION_NAME_LENGTH,
  type DesignDateOrder,
  type DesignSectionName,
  type DesignSectionNameKey,
  type DesignWording,
} from "@/lib/design";

// Examples, not the real date: they show the order, which is the choice.
const DATE_ORDERS: { value: DesignDateOrder; label: string }[] = [
  { value: "monthFirst", label: "September 29, 2026" },
  { value: "dayFirst", label: "29 September 2026" },
];

export function wordingSummary(wording: DesignWording): string {
  const renamed = DEFAULT_SECTION_NAMES.filter(({ key }) => wording.sectionNames[key].plural.trim()).length;
  const date = DATE_ORDERS.find((order) => order.value === wording.dateOrder)!.label;
  return renamed ? `${date}, ${renamed} renamed` : date;
}

/**
 * What a design calls each section, and which way round its dates go (#390).
 * Blank keeps the default name, shown as the placeholder.
 */
export function DesignWordingFields({
  wording,
  onChange,
}: {
  wording: DesignWording;
  onChange: (wording: DesignWording) => void;
}) {
  const setName = (key: DesignSectionNameKey, change: Partial<DesignSectionName>) =>
    onChange({
      ...wording,
      sectionNames: { ...wording.sectionNames, [key]: { ...wording.sectionNames[key], ...change } },
    });

  // Films, and the day first. Everything else in British English is
  // already the same.
  const ukEnglish =
    wording.dateOrder === "dayFirst" &&
    wording.sectionNames.movie.plural === "Films" &&
    wording.sectionNames.movie.singular === "Film";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="design-date-order">Dates</Label>
        <Select
          id="design-date-order"
          value={wording.dateOrder}
          onChange={(e) => onChange({ ...wording, dateOrder: e.target.value as DesignDateOrder })}
        >
          {DATE_ORDERS.map((order) => (
            <option key={order.value} value={order.value}>
              {order.label}
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted-foreground">In the email and its subject.</p>
      </div>

      <div role="group" aria-labelledby="design-section-names" className="flex flex-col gap-2">
        <p id="design-section-names" className="text-sm font-medium">
          Section names
        </p>
        <p className="text-xs text-muted-foreground">
          Each section&apos;s heading, its Browse button, the counts under the title, and its items&apos; badges.
          Leave one blank to keep it.
        </p>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-2 gap-y-2">
          <span className="text-xs text-muted-foreground" aria-hidden="true">
            Name
          </span>
          <span className="text-xs text-muted-foreground" aria-hidden="true">
            For one
          </span>
          {DEFAULT_SECTION_NAMES.map(({ key, plural, singular }) => (
            <div key={key} className="contents">
              <Input
                aria-label={`Name for ${plural}`}
                placeholder={plural}
                maxLength={MAX_SECTION_NAME_LENGTH}
                value={wording.sectionNames[key].plural}
                onChange={(e) => setName(key, { plural: e.target.value })}
              />
              {singular ? (
                <Input
                  aria-label={`Name for one of ${plural}`}
                  placeholder={wording.sectionNames[key].plural.trim() ? "Worked out from the name" : singular}
                  maxLength={MAX_SECTION_NAME_LENGTH}
                  value={wording.sectionNames[key].singular}
                  onChange={(e) => setName(key, { singular: e.target.value })}
                />
              ) : (
                <span className="self-center text-xs text-muted-foreground">Counted as episodes</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={ukEnglish}
          onClick={() =>
            onChange({
              dateOrder: "dayFirst",
              sectionNames: { ...wording.sectionNames, movie: { plural: "Films", singular: "Film" } },
            })
          }
        >
          Use UK English
        </Button>
        <span className="text-xs text-muted-foreground">Films, and the day first.</span>
      </div>
    </div>
  );
}
