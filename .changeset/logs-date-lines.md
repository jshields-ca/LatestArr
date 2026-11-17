---
"@latestarr/web": minor
---

**Improved:** The Logs page shows which day each line is from. A date line sits over each day's lines (**Today**, **Yesterday**, then the weekday and date, like **Saturday, November 14**), and stays at the top of the panel while that day scrolls past. Each line keeps its short time, and hovering it still shows the full date and time.

Also, the **ERROR** label on the Logs page is easier to read in the light theme.

<details>
<summary>Technical details</summary>

Closes #454. The page keeps the latest 500 lines since the server started, which can span days, and the date was only in a hover title, which phones can't show.

- `formatDay()` and `isSameDay()` in `lib/dates.ts` follow the viewer's locale and count days by the calendar, so 23:30 yesterday is **Yesterday** at 00:30. A date in another year includes the year.
- Date lines are worked out from the lines shown, so a level filter that leaves a day empty shows no line for it. Each is an `h2` with a `<time>`, so screen reader users can move from day to day.
- The hover title now uses `formatExactDateTime()`, like the rest of the app.
- **Fixed in passing:** the error and fatal labels used the theme's red, which is too dark on the log panel (dark in both themes) and failed axe's contrast check in the light theme. They now use a fixed lighter red, as the warn and info labels already do.

</details>
