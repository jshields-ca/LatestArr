---
"@latestarr/web": patch
---

Give the sidebar/nav-sheet's active nav item a left-edge accent bar (a 3px `bg-primary` pill) on top of its existing background tint, and give the hover state a slightly slower, clearer background transition — production feedback that the active state alone was easy to miss at a glance. `navItems` remains a flat list (no section grouping was added, since the current six items don't split into a natural, non-arbitrary category split).
