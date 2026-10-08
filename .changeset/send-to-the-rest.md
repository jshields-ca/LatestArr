---
"@latestarr/server": minor
"@latestarr/web": minor
"@latestarr/db": minor
---

**New:** **Send to the rest** finishes a newsletter that only reached some of its recipients, without sending anyone a duplicate. Use it when LatestArr stopped partway, the mail server turned some people away, or a rate limit cut a send off. Open the send's **Details** in the newsletter's **History** and choose **Send to the rest**. It sends the same email, with the same items, subject and images, to only the people who didn't get it, including anyone whose delivery failed. A confirmation shows who it will go to, and their results are added to the same send. It works on the newsletter's latest send, within its lookback window, and is for editors and admins.

<details>
<summary>Technical details</summary>

- Closes #283.
- **Migration `0010_send_to_the_rest`:**
  - `send_runs.subject`, set with `rendered_html`;
  - `send_runs.rest_sent_at`;
  - a new `send_run_attachments` table holding a send's embedded images (cid, filename, type, bytes). A newsletter's earlier sends' images are deleted when its next send renders, so storage stays at one send per newsletter.
- **New `pipeline/send-to-the-rest.ts`:**
  - `planSendToTheRest()` checks that the send is `partial_failure` or `failed` and has its stored subject, HTML and every referenced image.
  - It also checks that it's the newsletter's latest send (no later send, by insertion order, reached anyone) and that it started within `lookbackDays`.
  - It returns the newsletter's active recipients not recorded as `sent`.
  - `sendToTheRest()` claims the run by setting it to `running` in one conditional `UPDATE`, which shares Send now's "already running" lock and stops two requests from both sending. It then sends, replaces each recipient's earlier result, and sets the final status, `finishedAt` and `restSentAt`, in a `finally` block.
  - If LatestArr stops partway, the startup clean-up from #280 closes the send as usual.
- **API:**
  - `GET /newsletters/:id/send-runs/:runId/rest` (editor) returns the plan, or why the send can't be finished.
  - `POST /newsletters/:id/send-runs/:runId/send-to-rest` (editor) answers 409 when the send can't be finished or another send is running.
  - The History list adds `canSendToRest` and `restSentAt`, and breaks ties on start time by insertion order.
- **Web:** a `SendToRestDialog` in the send's details, and "Sent to the rest" with its time in History.
- **Docs:** `self-hosting.md` covers finishing a partly sent newsletter. The interrupted-send message and alert now point to **Send to the rest**.

</details>
