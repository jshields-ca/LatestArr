---
"@latestarr/web": minor
---

Rebrand from the original teal/cyan accent to "Bloom," a rose accent chosen to stand apart from the blue/teal/purple already common across the self-hosted media ecosystem (and from Plex's own orange). Along with it:

- The light theme's neutrals move from stark white to a warm, rose-tinted scale, with a softer tinted shadow replacing the previous flat `shadow-sm` on every card, and a hover lift + shadow on primary buttons.
- Status badges gain an opt-in `dot` prop (a small pulsing indicator, respecting `prefers-reduced-motion`) — used on the Sources screen's "Connected" status, the one genuinely live indicator in the app.
- The logo mark changes from a double-chevron to an envelope with a spark, reading as "a newsletter just arrived" rather than a generic up-trend glyph.
- The "LatestArr" wordmark specifically now renders in Newsreader, a serif built for reading/publication contexts, while every other heading and all body/UI text stays on the default sans stack.
