---
"@latestarr/web": patch
---

**Fixed:** The page footer now stays pinned to the bottom of the browser window on short pages instead of sitting mid-page above empty background.

<details>
<summary>Technical details</summary>

The design-polish-round-2 layout change (#125) dropped `flex-1` from the header/sidebar/main content row to fix a different bug — an explicit `h-[calc(100vh-3.5rem)]` height on `aside` was forcing that row to a full viewport height regardless of the footer, causing scroll dead-space on short pages. Removing `flex-1` fixed that but introduced this one: without it, the content row no longer grows to fill leftover space in the `min-h-screen` flex column, so `AppFooter` renders right after short content instead of at the bottom of the viewport.

Restored `flex-1` on the content row (`apps/web/src/components/app-shell.tsx`) without restoring `aside`'s explicit height — `flex-1` alone (paired with `min-h-screen` on the root) fills exactly the space the header and footer leave, with no explicit-height side effect that would force `100vh` regardless of footer height.

Also fixed the local dev proxy (`apps/web/vite.config.ts`): `changeOrigin: true` rewrote the outgoing `Host` header to match the API server but left `Origin` as the Vite dev origin, which tripped the server's same-origin CSRF check (`requireSameOrigin`) on every mutating request when running `apps/web` and `apps/server` as separate dev servers. The proxy now rewrites `Origin` to match too.

</details>
