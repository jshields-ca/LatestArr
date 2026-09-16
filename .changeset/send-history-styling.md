---
"@latestarr/web": patch
---

Restyle the Send History list on the newsletter card so each send-run reads as a distinct, scannable row instead of plain wrapped text: a status icon (matched to the existing badge colors), the timestamp and outcome badge on one line, item/recipient counts and any error message below, all inside a bordered row. Failed and partially-failed sends get a red left accent and tinted background so problems stand out without reading every row. No changes to what data is fetched or when it refreshes.
