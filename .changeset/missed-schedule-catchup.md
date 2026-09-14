---
"@latestarr/server": minor
---

Catch up newsletters whose scheduled send was missed while the process was down. On boot, the scheduler now checks each enabled newsletter's last actual send (or creation time, if it's never sent) against its cron schedule, and runs it once if a scheduled fire was missed — previously a missed occurrence during downtime just silently never happened.
