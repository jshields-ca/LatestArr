import { describe, expect, it } from "vitest";
import { readBytesCapped } from "./http-limits.js";

function streamed(chunks: number[], headers: Record<string, string> = {}): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const size of chunks) controller.enqueue(new Uint8Array(size).fill(1));
      controller.close();
    },
  });
  return new Response(body, { headers });
}

describe("readBytesCapped", () => {
  it("reads a body within the limit", async () => {
    const bytes = await readBytesCapped(streamed([3, 4]), 10);
    expect(bytes?.byteLength).toBe(7);
  });

  it("gives up on a body that declares itself too large", async () => {
    expect(await readBytesCapped(streamed([1], { "content-length": "11" }), 10)).toBeNull();
  });

  it("gives up on a body that turns out too large without saying so", async () => {
    expect(await readBytesCapped(streamed([6, 6]), 10)).toBeNull();
  });
});
