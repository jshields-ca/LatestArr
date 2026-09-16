---
"@latestarr/server": patch
---

Add regression test coverage in `renderMjmlTemplate` for a bug found while verifying the template editor's new preset blocks (apps/web): a `<table>` placed directly under `<mj-column>` (rather than wrapped in `<mj-raw>`) gets silently dropped by MJML's compiler under "soft" validation, with no thrown error. No production server behavior changes — the fix itself is in `apps/web`'s block library, which is what emits this markup.
