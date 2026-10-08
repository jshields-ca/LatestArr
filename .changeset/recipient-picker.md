---
"@latestarr/web": patch
---

**Improved:** Adding people to a group on the Recipients page is quicker. The dropdown is now a search box. Type part of a name or email to narrow the list (capitals and accents don't matter), then click a person or press Enter to add them. The box stays open, so you can add several people in a row. The list is sorted by name, with numbers first, instead of the order people were added, and inactive people are marked. The recipient list and the edit panel's group list use the same sorting.

<details>
<summary>Technical details</summary>

- Closes #287.
- New `components/ui/combobox.tsx`, an accessible ARIA combobox built on the existing Radix Popover. Focus stays in the text box, the active option is tracked with `aria-activedescendant`, and Arrow keys, Home, End, Enter and Escape work. Up to 50 matches show, with a "type to narrow" note beyond that.
- New `lib/text.ts`:
  - `compareText`: `Intl.Collator` with numeric sorting and base sensitivity;
  - `foldForSearch` and `matchesSearch`: NFD folding, ignoring case and accents.
- The recipient table's name and email sort and its search use these too.

</details>
