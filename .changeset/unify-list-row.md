---
"@latestarr/web": patch
---

Consolidate the admin CRUD pages (Sources, Recipients & Groups, SMTP Profiles, Newsletters, Templates) onto a shared `ListRow` component instead of five hand-rolled row layouts that had drifted apart in spacing, hover treatment, and how metadata badges sat next to a row's name. Every row now uses the same leading-icon/primary/secondary/actions shape and the same responsive header layout (stacked on mobile, side-by-side from `sm:` up), so moving between pages no longer shows subtly different row heights or gaps. Also dedupes the identical `ConfirmDelete` inline prompt that Recipients and Templates each defined on their own into a shared `ConfirmDeleteButton`. No page's behavior, click targets, or `aria-label`s changed — this is a visual/structural consolidation only.

Also gives Recipient Groups an Edit dialog (previously groups could only be added and deleted, so fixing a typo in a group's name meant losing its members by recreating it). It mirrors Recipients' own Edit dialog and reuses the `PATCH /recipient-groups/:id` server route that already existed for it.
