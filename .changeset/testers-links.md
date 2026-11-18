---
"@latestarr/web": patch
---

**Improved:** When you add a source that still needs testers, the note says where to report: open an issue if something doesn't work, or say so in Discussions if it does.

<details>
<summary>Technical details</summary>

The two "help test" issues (#196, #244) are being closed, so the add-source dialog links to the bug report form and GitHub Discussions instead. The README's sources table and tip say the same. A source's config now has `needsTesters` instead of a `testersIssue` URL.

</details>
