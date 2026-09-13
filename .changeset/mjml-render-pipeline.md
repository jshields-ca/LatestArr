---
"@latestarr/server": minor
---

Add an MJML render pipeline: newsletters linked to a template now render via that template's compiled MJML (substituting real item data through the same Handlebars data-binding layer as the built-in starter template, then compiling to safe, Outlook/Gmail-friendly HTML with `mjml`), falling back to the hardcoded starter template when no custom template is linked or it has no compiled MJML yet.
