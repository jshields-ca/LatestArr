---
"@latestarr/server": patch
"@latestarr/web": patch
---

**Fixed:** The Backups page's restore commands assumed your container is called latestarr, and their copy buttons said "Couldn't copy" when LatestArr was opened at a plain http:// address. A **Container name** field now fills your container's name into every command, and copying works over http too. The restore command's own instructions no longer name a container. (#485)

<details>
<summary>Technical details</summary>

- **Container name:** typed on the Backups page and kept in the browser's local storage. Only Docker's name characters (`[a-zA-Z0-9][a-zA-Z0-9_.-]*`) are used, so a pasted name can't add anything else to a command someone copies and runs; anything else shows a hint and the commands keep `latestarr`.
- **Copy:** browsers offer `navigator.clipboard` only in a secure context (https or localhost). `lib/clipboard.ts` falls back to copying from a hidden text field with `document.execCommand("copy")`.
- **CLI:** `restore` now says `docker restart <container name>` and `docker exec -it <container name> node dist/cli.js restore --cancel`.

</details>
