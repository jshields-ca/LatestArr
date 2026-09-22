---
"@latestarr/web": minor
"@latestarr/server": minor
"@latestarr/db": minor
---

**New:** Recent Sends history now shows exactly who a send went to and what it included, with a link to the actual rendered copy — not just aggregate counts.

<details>
<summary>Technical details</summary>

`send_runs` gains two columns, set once rendering succeeds (independent of whether individual recipient deliveries later fail): `items_snapshot` (a lightweight `{title, kind}[]` JSON snapshot — the same set `item_count_included` has always counted, now also captured with titles) and `rendered_html` (the actual HTML that was sent, stored verbatim rather than re-rendered on demand, so it reflects exactly what a recipient received even if templates/sources changed since).

Per-recipient detail already existed in `send_run_recipient_results` (populated by the send pipeline, but never exposed) — new `GET /newsletters/:id/send-runs/:runId/recipients` joins it with `recipients` for each row's email/displayName. New `GET /newsletters/:id/send-runs/:runId/html` serves the stored `rendered_html` directly as `text/html` (a link target, not a JSON-fetched value). The existing list endpoint (`GET /newsletters/:id/send-runs`) explicitly excludes `rendered_html` from each row — it can be tens to hundreds of KB and the list can return many runs at once.

The newsletter History tab's send-run rows gain a "Details" toggle (only shown when there's something to show) that lazily fetches recipients and renders included-item badges, a per-recipient status list, and a "View a copy of this send" link to the raw HTML endpoint.

</details>
