---
"@latestarr/server": patch
---

Fix the admin UI failing to load entirely (blank page) when accessed directly over plain HTTP without a reverse proxy in front. `@fastify/helmet`'s Content-Security-Policy defaults silently include `upgrade-insecure-requests`, which tells the browser to rewrite every `http://` subresource request (the JS bundle, CSS, favicon) to `https://` before sending it — independent of any browser "HTTPS-Only Mode" setting, and unaffected by exceptions or private browsing. Since LatestArr has no TLS listener of its own (TLS is expected to come from a reverse proxy), those upgraded requests failed outright and the app never rendered. The directive is now explicitly removed from the CSP.
