---
"@latestarr/web": patch
---

**Fixed:** Five small problems found in the interface review.

- **Recipients on a phone:** the page no longer slides sideways. Import, From a source and Add recipient wrap under the heading, so Add recipient is back on screen.
- **Dashboard:** the Sources tile says "All connected" only when every source has passed a test. Otherwise it says how many aren't tested yet, or how many need attention.
- **Newsletters:** the switch beside each newsletter says **Scheduled** or **Paused**. It used to say "Enabled" even when it was off. Paused stops scheduled sends only; Send now still works.
- **Dates** are written one way, like "Sun, Nov 8, 9:46 PM", with the exact time when you hover. Recent sends used to show seconds.
- **Switches are larger,** so they're easier to tap.

<details>
<summary>Technical details</summary>

Audit findings 1, 3, 5, 9 and 11 from the UI review (#332). The Recipients heading row and its button group use `flex-wrap` (the row was 543px wide at 390px). The dashboard counts `status === "unconfigured"` sources separately from errors. `Switch` is 44×24px (`h-6 w-11`), up from 36×20; the custom-cron toggle and the design editor's "More colours" summary are 24px tall. `lib/dates.ts` adds `formatDateTime` (no seconds; the year only when it isn't this one), `formatExactDateTime` and `formatDate`, in the viewer's locale; `DateTime` renders a `<time>` with the exact moment as its title. Send history, Backups and Users use them. Logs keep their own second-level timestamps. The newsletter switch isn't labelled "On" because the schedule's day field already is.

</details>
