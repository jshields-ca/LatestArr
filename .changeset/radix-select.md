---
"@latestarr/web": minor
---

Replace the native `<select>` dropdown with a custom-rendered one built on `@radix-ui/react-select`. Every other primitive in the app (Button, Dialog, Switch, Input) is already fully themed, but the browser's own OS dropdown chrome still showed through whenever a Select was opened — bright white on Linux/Windows, breaking out of the app's dark, all-custom aesthetic. The dropdown popover now matches the app's dialogs (same border/shadow/radius/animation language) in both light and dark mode. `Select`'s props are unchanged for every existing call site.
