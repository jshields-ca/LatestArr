import type { FastifyReply } from "fastify";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { parseBody } from "./validate.js";

function fakeReply() {
  const send = vi.fn();
  const reply = { code: vi.fn(() => ({ send })) } as unknown as FastifyReply;
  return { reply, send };
}

describe("parseBody", () => {
  const schema = z.object({ email: z.email(), age: z.number().int().optional() });

  it("returns the parsed data on a valid body", () => {
    const { reply } = fakeReply();
    const result = parseBody(schema, { email: "a@b.com", age: 5 }, reply);
    expect(result).toEqual({ email: "a@b.com", age: 5 });
  });

  it("sends a 400 with the first issue's message and returns undefined for a missing field", () => {
    const { reply, send } = fakeReply();
    const result = parseBody(schema, {}, reply);
    expect(result).toBeUndefined();
    expect(reply.code).toHaveBeenCalledWith(400);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });

  it("sends a 400 for a field of the wrong type rather than coercing it", () => {
    const { reply, send } = fakeReply();
    const result = parseBody(schema, { email: "a@b.com", age: "not-a-number" }, reply);
    expect(result).toBeUndefined();
    expect(reply.code).toHaveBeenCalledWith(400);
    expect(send).toHaveBeenCalledWith({ error: expect.any(String) });
  });

  it("rejects a non-object body instead of throwing", () => {
    const { reply, send } = fakeReply();
    const result = parseBody(schema, "not-an-object", reply);
    expect(result).toBeUndefined();
    expect(reply.code).toHaveBeenCalledWith(400);
    expect(send).toHaveBeenCalled();
  });

  it("rejects an undefined body instead of throwing", () => {
    const { reply, send } = fakeReply();
    const result = parseBody(schema, undefined, reply);
    expect(result).toBeUndefined();
    expect(send).toHaveBeenCalled();
  });
});
