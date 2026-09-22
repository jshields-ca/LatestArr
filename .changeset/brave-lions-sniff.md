---
"@latestarr/web": minor
---

**Improved:** The expanded newsletter row is now organized into two clearly labeled panels — Schedule (with its own Delivery subsection) and Content (Template/Sources/Groups) — instead of one long stack of boxes, and the collapsed row's schedule line now highlights the frequency and time instead of reading as one flat muted sentence.

<details>
<summary>Technical details</summary>

Addresses production feedback that the Details tab (`NewsletterDetailsForm`/`NewsletterCard` in `apps/web/src/pages/newsletters-page.tsx`) dumped everything — Name, Schedule, Delivery, Subject template, Template, Sources, Groups — as one flat vertical stack, and that the collapsed row's summary line (e.g. "Weekly on Monday at 8:00 AM (America/Winnipeg) · 7-day lookback") was a single undifferentiated muted string.

- Added `describeScheduleParts()` (`apps/web/src/lib/schedule.ts`) — same parsing as the existing `formatScheduleForDisplay`, but returns `{ frequency, when, timezone }` separately instead of one sentence, so the collapsed row can render frequency as a `Badge` and the day/time in a bolder weight, with timezone/lookback staying muted.
- Restructured the expanded Details tab into a `sm:grid-cols-2` layout: the left column is `NewsletterDetailsForm` (Name, then a "Schedule" panel containing the existing `ScheduleField` — cron/advanced toggle unchanged — plus a nested "Delivery" subsection for lookback/SMTP profile/subject template); the right column is a new "Content" panel wrapping the existing `TemplatePicker`/`LinkedSources`/`LinkedGroups` (unchanged behavior — same add-via-dropdown, remove-via-chip pattern). Stacks to one column below `sm`.
- No functional changes to any picker or the schedule/cron logic — this is a layout and typography pass only.

</details>
