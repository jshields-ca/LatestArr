---
"@latestarr/web": minor
---

**Improved:** Editing a newsletter is now a clear Details/History split — Details holds every configuration field (name, schedule, delivery, subject, and now the Template, Sources, and Recipient groups pickers too), and History shows only its send runs.

<details>
<summary>Technical details</summary>

Addresses production feedback that the Template/Sources/Groups pickers lived only in the newsletter row's expanded "accordion" section, separate from the pencil-icon "Edit newsletter" dialog that held name/schedule/lookback/SMTP profile/subject — so a user opening a newsletter to configure it wouldn't find the Template dropdown where they'd expect it, and the accordion looked purely informational.

Restructures each `NewsletterCard`'s expanded content (`apps/web/src/pages/newsletters-page.tsx`) into a new `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` primitive (`apps/web/src/components/ui/tabs.tsx`, wrapping `@radix-ui/react-tabs` — newly added to `apps/web/package.json`, following the same forwardRef/`cn` wrapping convention as `select.tsx` and `dialog.tsx`) with two tabs: **Details** and **History**. The former "Edit newsletter" dialog is gone — its fields (now `NewsletterDetailsForm`, same `updateNewsletter` call and validation, just rendered inline instead of inside a `Dialog`) live in the Details tab alongside the existing `TemplatePicker`, `LinkedSources`, and `LinkedGroups` components (unchanged) and the "Enabled" toggle (moved out of the always-visible row into Details, since it's newsletter configuration like everything else there). "Send now" stays in Details since it's an action tied to that configuration, not history. History is now just the `SendRunHistoryList`, nothing else. Field ids across the moved-in form are namespaced per newsletter (`newsletter-<id>-name`, etc.) to stay unique with multiple rows expanded at once. Radix's Tabs gives this ARIA `tablist`/`tab`/`tabpanel` roles and roving-focus arrow-key navigation for free, matching the accessibility this app already relies on elsewhere.

</details>
