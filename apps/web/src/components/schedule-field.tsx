import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  DAY_NAMES,
  TIMEZONES,
  formatHourMinute,
  parseHourMinute,
  type Frequency,
  type SimpleSchedule,
} from "@/lib/schedule";

export type ScheduleMode = "simple" | "advanced";

interface ScheduleFieldProps {
  mode: ScheduleMode;
  onModeChange: (mode: ScheduleMode) => void;
  simple: SimpleSchedule;
  onSimpleChange: (simple: SimpleSchedule) => void;
  scheduleCron: string;
  onScheduleCronChange: (cron: string) => void;
  timezone: string;
  onTimezoneChange: (timezone: string) => void;
  disabled?: boolean;
  idPrefix: string;
}

export function ScheduleField({
  mode,
  onModeChange,
  simple,
  onSimpleChange,
  scheduleCron,
  onScheduleCronChange,
  timezone,
  onTimezoneChange,
  disabled,
  idPrefix,
}: ScheduleFieldProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label>Schedule</Label>
        <button
          type="button"
          onClick={() => onModeChange(mode === "simple" ? "advanced" : "simple")}
          disabled={disabled}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
        >
          {mode === "simple" ? "Use a custom cron expression" : "Use a simple schedule"}
        </button>
      </div>

      {mode === "simple" ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-frequency`}>Repeats</Label>
            <Select
              id={`${idPrefix}-frequency`}
              value={simple.frequency}
              onChange={(e) => onSimpleChange({ ...simple, frequency: e.target.value as Frequency })}
              disabled={disabled}
            >
              <option value="daily">Every day</option>
              <option value="weekly">Every week</option>
              <option value="monthly">Every month</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-time`}>At</Label>
            <Input
              id={`${idPrefix}-time`}
              type="time"
              required
              value={formatHourMinute(simple.hour, simple.minute)}
              onChange={(e) => {
                const parsed = parseHourMinute(e.target.value);
                if (parsed) onSimpleChange({ ...simple, ...parsed });
              }}
              disabled={disabled}
            />
          </div>
          {simple.frequency === "weekly" ? (
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor={`${idPrefix}-day-of-week`}>On</Label>
              <Select
                id={`${idPrefix}-day-of-week`}
                value={simple.dayOfWeek}
                onChange={(e) => onSimpleChange({ ...simple, dayOfWeek: Number(e.target.value) })}
                disabled={disabled}
              >
                {DAY_NAMES.map((name, index) => (
                  <option key={name} value={index}>
                    {name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          {simple.frequency === "monthly" ? (
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor={`${idPrefix}-day-of-month`}>On day of the month</Label>
              <Input
                id={`${idPrefix}-day-of-month`}
                type="number"
                min={1}
                max={28}
                required
                value={simple.dayOfMonth}
                onChange={(e) => onSimpleChange({ ...simple, dayOfMonth: Number(e.target.value) })}
                disabled={disabled}
              />
              <p className="text-xs text-muted-foreground">
                Capped at 28 so it falls on a real date every month.
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-cron`}>Cron expression</Label>
          <Input
            id={`${idPrefix}-cron`}
            required
            placeholder="0 8 * * 1"
            value={scheduleCron}
            onChange={(e) => onScheduleCronChange(e.target.value)}
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">
            Standard 5-field cron (minute hour day-of-month month day-of-week).
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-timezone`}>Timezone</Label>
        <Select
          id={`${idPrefix}-timezone`}
          value={timezone}
          onChange={(e) => onTimezoneChange(e.target.value)}
          disabled={disabled}
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
