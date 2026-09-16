---
"@latestarr/server": patch
---

Fix a real send-failure bug: a custom template saved from the builder before it's ever had an initial design loaded exports a bare MJML fragment (no `<mjml><mj-body>` root element). `renderMjmlTemplate` now wraps such a fragment before compiling instead of letting `mjml2html` reject it outright — previously this would fail the entire send rather than falling back to best-effort rendering, the same way a malformed template already does.
