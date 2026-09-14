import type { FastifyReply, FastifyRequest } from "fastify";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function hostFromUrlLike(value: string): string | undefined {
  try {
    return new URL(value).host;
  } catch {
    return undefined;
  }
}

/**
 * CSRF defense via same-origin check (the pattern Django/Rails use by
 * default), not a double-submit token: a browser always sends `Origin` on
 * a cross-origin fetch/XHR POST/PUT/PATCH/DELETE, so rejecting a
 * present-but-mismatched Origin blocks a forged cross-site request while
 * needing no frontend changes at all. A request with no Origin or Referer
 * (curl, Fastify's own `inject()` in tests, older browsers) is let through
 * rather than rejected — CSRF specifically requires a *browser* to attach
 * the victim's cookies, and browsers that omit both headers on state-
 * changing fetches are not a realistic attack path here.
 */
export function requireSameOrigin() {
  return async function requireSameOriginHook(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (SAFE_METHODS.has(request.method)) return;

    const origin = request.headers.origin;
    const referer = request.headers.referer;
    const sourceHost = origin ? hostFromUrlLike(origin) : referer ? hostFromUrlLike(referer) : undefined;
    if (!sourceHost) return;

    if (sourceHost !== request.headers.host) {
      return reply.code(403).send({ error: "Cross-origin request rejected" });
    }
  };
}
