---
"@latestarr/web": patch
---

Fix five usability bugs in the template editor: GrapesJS's default panel buttons (Open Blocks, Settings, Layers, etc.) rendered as blank squares because their built-in icons depend on Font Awesome, which this app never loads; the editor's selection/active-state accent showed GrapesJS's own stock orange (from the grapesjs-mjml plugin's custom theme) instead of the app's Bloom pink; clicking the Media List block's preview card selected an inner generic child instead of the block itself, hiding its real Content type/Sort/Number of items traits behind an unlabeled "select parent" step; the Move up/down toolbar buttons rendered as thin unicode arrows next to GrapesJS's bold icons and silently no-opped at the top/bottom of a list with no feedback; and the editor had no unsaved-changes protection at all, so a refresh or the page's own Back button silently discarded in-progress work.
