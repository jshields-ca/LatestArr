---
"@latestarr/adapter-booklore-family": patch
---

**Fixed:** A book's release year from Book Orbit/BookLore could show one year earlier than its actual publication year, for anyone self-hosting in a timezone west of UTC.

<details>
<summary>Technical details</summary>

`mapEntry()` in `packages/adapters/booklore-family/src/booklore-adapter.ts` built `releaseDate` from OPDS's `dc:issued` field via `new Date(issued)`. `dc:issued` only ever appears as a bare 4-digit year (e.g. `"2020"`), and `new Date("2020")` parses that as UTC midnight — reading it back with local-time getters (`getFullYear()`, `toLocaleDateString()`, ...) in any negative-UTC-offset timezone rolls it back to December 31 of the previous year.

Also the root cause of a flaky test (`booklore-adapter.test.ts`'s "maps entries and filters by the since cutoff", filed as #164) that only failed on a non-UTC-configured machine.

Fixed by constructing the date in local time (`new Date(Number(issued), 0, 1)`) when `dc:issued` is a bare year, so the year survives the round trip regardless of the host's timezone. A full date string, should one ever appear, still goes through the plain `Date` parser unchanged.

</details>
