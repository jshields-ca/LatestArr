---
"@latestarr/adapter-romm": minor
"@latestarr/server": minor
---

Add a RomM adapter (`@latestarr/adapter-romm`) for connecting game ROM libraries — authenticates with a RomM Client API Token (bearer auth) against its documented REST API, listing platforms as libraries and recently-added ROMs. Unlike Audiobookshelf, RomM's rom-listing endpoint accepts a repeatable `platform_ids` filter directly, so a multi-library fetch is a single request rather than a per-library loop.
