import type { FastifyReply } from "fastify";
import type { z } from "zod";

// Sends the 400 itself (matching every route's existing `{ error: "..." }`
// shape) so call sites can stay a single early-return, the same shape as
// the ad-hoc `if (!field) return reply.code(400).send(...)` checks this
// replaces.
export function parseBody<T extends z.ZodType>(
  schema: T,
  body: unknown,
  reply: FastifyReply,
): z.infer<T> | undefined {
  const result = schema.safeParse(body);
  if (result.success) return result.data;

  const message = result.error.issues[0]?.message ?? "Invalid request body";
  void reply.code(400).send({ error: message });
  return undefined;
}
