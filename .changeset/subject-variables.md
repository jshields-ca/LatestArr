---
"@latestarr/server": minor
"@latestarr/web": minor
---

**New:** Subject variables, so each issue's subject can change with each send, such as "The latest from {period}" or "{count} new: {counts}".

- **Variables:** `{newsletter}`, `{date}`, `{shortDate}`, `{period}`, `{month}`, `{year}`, `{count}` and `{counts}`. They're filled in on each send in the newsletter's timezone, so the subject matches the dates in the email.
- **In the form:** **Insert a variable** adds one at the cursor, and a live line shows the next subject (with example counts). A misspelled variable like `{dat}` is flagged as you type, and saving refuses it, so a typo never reaches an inbox.
- **Preview and history:** **Preview** shows the real next subject, **Send test** uses it (with `[Test]`), and History records the subject as sent.
- **Nothing new:** a subject built around `{count}` or `{counts}` becomes "<newsletter>: nothing new" instead of "0 new".
- **Unchanged:** a blank subject still uses the newsletter's name, and existing subjects work exactly as before.
- **Fixed:** clearing a newsletter's subject now saves. It used to keep the old one.

<details>
<summary>Technical details</summary>

- Closes #267.
- **`render/subject.ts`:**
  - `renderSubject` uses single-brace placeholders, not Handlebars, so there's no HTML escaping or template errors in a plain-text header. Only known variables are replaced, and other braces stay as typed.
  - The result has control characters and line breaks turned into spaces (no header injection), is trimmed, and is capped at 200 characters.
  - `unknownSubjectVariables` backs the save-time check, which uses a plain-language message.
- **`render/dates.ts`:** timezone-aware date formatting, now shared by the subject and the email's send date and date range (`generatedAtFormatted`, `periodFormatted`). The email's dates now use the newsletter's timezone instead of the server's. That only differs around midnight, and an invalid timezone falls back to the server's.
- **Web:** `components/subject-field.tsx` and `lib/subject.ts`, which mirrors the server's variables and formatting for the live preview.

</details>
