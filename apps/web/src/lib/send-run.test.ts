import { describe, expect, it } from "vitest";

import type { SendRun } from "./api";
import { sendRunBadgeLabel, sendRunBadgeVariant } from "./send-run";

function run(overrides: Partial<SendRun>): SendRun {
  return {
    id: "r1",
    newsletterId: "n1",
    status: "success",
    startedAt: "2026-09-27T09:00:00.000Z",
    finishedAt: "2026-09-27T09:00:05.000Z",
    itemCountIncluded: 3,
    recipientCount: 2,
    error: null,
    itemsSnapshot: null,
    ...overrides,
  };
}

describe("send-run badges", () => {
  it("labels a skipped run as skipped, not as an empty send", () => {
    const skipped = run({ status: "skipped", itemCountIncluded: 0, recipientCount: 0 });
    expect(sendRunBadgeLabel(skipped)).toBe("Skipped (nothing new)");
    expect(sendRunBadgeVariant(skipped)).toBe("neutral");
  });

  it("still flags a successful send that had nothing in it", () => {
    const empty = run({ itemCountIncluded: 0 });
    expect(sendRunBadgeLabel(empty)).toBe("Sent (empty)");
    expect(sendRunBadgeVariant(empty)).toBe("warning");
  });
});
