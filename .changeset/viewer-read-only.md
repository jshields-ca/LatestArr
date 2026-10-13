---
"@latestarr/web": patch
---

**Fixed:** Viewers can no longer change dropdowns they can't save.

- **Read-only means read-only:** on newsletters and designs, viewers could open dropdowns like Repeats, Timezone, Font, or a newsletter's Design, and change them, only to find they couldn't save. Those dropdowns are now disabled like the rest of a read-only form.
- **No false warnings:** viewers are no longer asked about unsaved changes when leaving a page they can't edit.
- **Your role, tidier:** editors and viewers see their role as a small badge beside their name in the header, instead of a cramped extra line.

<details>
<summary>Technical details</summary>

- From release testing in #281.
- **`components/ui/select.tsx`:** Radix's Select opens on pointerdown, which a disabled `<fieldset>` doesn't stop. The wrapper now controls `open`, and refuses to open while the trigger matches `:disabled`, which covers a disabled fieldset as well as its own `disabled` prop. There's a new `select.test.tsx`.
- **`useUnsavedChanges`:** registered only when the user can edit, in the newsletter details form and the design editor. The design editor's Back button doesn't ask a viewer.
- **`UserSummary`:** a neutral `Badge` with the role, titled "You have viewer access".

</details>
