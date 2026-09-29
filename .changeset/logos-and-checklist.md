---
"@latestarr/web": minor
---

**Improved:** Sources now show each service's own logo, including Jellyfin and Emby, and the Source type list is alphabetical. The setup checklist also suggests failure alerts and a second admin, both optional.

<details>
<summary>Technical details</summary>

- Bundled `jellyfin.svg` and `emby.svg` from selfh.st/icons (CC BY 4.0), credited in `assets/logos/NOTICE.md`. (#231)
- Source types are sorted by display name; the Add source dialog defaults to the first. (#231)
- A source row's leading icon is the service logo, with the category icon kept as a fallback (`hasSourceLogo`); the type badge is now plain text. (#232)
- The dashboard checklist adds optional **Get failure alerts** (done when an email or webhook alert is enabled for failures) and **Add another admin** (done with more than one user). Screen readers now hear "Done" on completed steps. (#233)

</details>
