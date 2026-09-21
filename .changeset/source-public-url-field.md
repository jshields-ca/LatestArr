---
"@latestarr/web": minor
---

**New:** Sources now have an optional "Public URL" field, for when a source's own address isn't one you'd want a recipient clicking into — e.g. Tautulli's address is its own API host, not the Plex link people actually want, or a source's address is a Tailscale/LAN address unreachable from outside your network.

<details>
<summary>Technical details</summary>

Adds a "Public URL (optional)" input to both the Add-source and Edit-source dialogs (`apps/web/src/pages/sources-page.tsx`), right under the existing Base URL field, with helper text explaining when a self-hoster would want it: "The address your recipients can actually reach — leave blank to use the address above. Useful when this source's address above is internal-only (e.g. a Tailscale IP or an API host like Tautulli that isn't itself the link you want people to click)." Wired into the same create/update API calls as `baseUrl` (`createSource`/`updateSource` in `apps/web/src/lib/api.ts`); left blank, it's simply omitted on create and clears any previously-set value on update. Server-side support (the `publicUrl` column and its use in building per-item links) ships alongside this in `@latestarr/server`.

Also makes items in a GrapesJS-authored Media List block (and the composite "All New (This Period)" block, which reuses the same card markup) clickable: `mediaListCardBody` in `apps/web/src/lib/grapesjs-blocks.ts` now wraps an item's title and poster in `<a href="{{externalUrl}}">` when the rendered item has one, styled to inherit the surrounding title color with no underline, falling back to plain text/image when it doesn't — mirroring the same treatment the default (non-custom) newsletter layout got in `@latestarr/server`.

</details>
