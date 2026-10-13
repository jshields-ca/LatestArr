---
"@latestarr/web": patch
---

**Improved:** Viewers get a fully read-only view, and everyone can see their role.

- **Read-only means read-only:** on newsletters and designs, every control is disabled for viewers, dropdowns included, and they're never asked about unsaved changes.
- **Your role:** editors and viewers see a small **Editor** or **Viewer** badge beside their name in the header.

<details>
<summary>Technical details</summary>

- From release testing in #281.
- **`components/ui/select.tsx`:** Radix's Select opens on pointerdown, which a disabled `<fieldset>` doesn't stop. The wrapper now controls `open`, and refuses to open while the trigger matches `:disabled`, which covers a disabled fieldset as well as its own `disabled` prop. There's a new `select.test.tsx`.
- **`useUnsavedChanges`:** registered only when the user can edit, in the newsletter details form and the design editor. The design editor's Back button doesn't ask a viewer.
- **`UserSummary`:** a neutral `Badge` with the role, titled "You have viewer access".

</details>
