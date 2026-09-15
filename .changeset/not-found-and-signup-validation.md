---
"@latestarr/web": patch
---

Add a proper "Page not found" screen (with a link back to the Dashboard) for unknown routes, replacing the blank content area you'd get from mistyping a URL like `/smtp-profiles` instead of `/smtp`. Also fix the first-admin signup form only flagging the Password field when submitted empty — Name and Email now get the same red-border-and-inline-message treatment when they're missing too.
