import { type Db, recipients } from "@latestarr/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Logger } from "../../logger.js";
import { isUnsubscribeToken } from "../../mailer/unsubscribe.js";
import { parseBody } from "../validate.js";

// Public, on purpose (#383): a recipient has no account. The token is the
// only key, so these change one thing (whether that person gets
// newsletters) and say nothing about who it is or who else is on the list.
// Opening a link changes nothing either: the page asks first, so a mail
// scanner that follows links can't unsubscribe someone.

// Few legitimate requests per address; enough for a person changing their
// mind, little for anyone guessing tokens (122 random bits each).
const LIMIT = { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } };

const pageSchema = z.object({
  token: z.string().max(64),
  subscribed: z.boolean(),
});

type Outcome = { subscribed: boolean } | null;

// Sets someone's choice by token. Null when no one has that token.
function setSubscribed(db: Db, token: string, subscribed: boolean, how: string, log: Logger): Outcome {
  if (!isUnsubscribeToken(token)) return null;
  const recipient = db.select().from(recipients).where(eq(recipients.unsubscribeToken, token)).get();
  if (!recipient) return null;
  const isSubscribed = recipient.unsubscribedAt === null;
  if (isSubscribed !== subscribed) {
    db.update(recipients)
      .set({ unsubscribedAt: subscribed ? null : new Date() })
      .where(eq(recipients.id, recipient.id))
      .run();
    log.info(
      { recipientId: recipient.id, how },
      subscribed ? `${recipient.email} subscribed again` : `${recipient.email} unsubscribed (${how})`,
    );
  }
  return { subscribed };
}

export function registerUnsubscribeRoutes(app: FastifyInstance, db: Db): void {
  void app.register(async (scope) => {
    // A mail app's one-click request (RFC 8058) is a form post whose body
    // is just "List-Unsubscribe=One-Click"; it's accepted and not needed.
    scope.addContentTypeParser(
      ["application/x-www-form-urlencoded", "multipart/form-data"],
      { parseAs: "string", bodyLimit: 2048 },
      (_request, body, done) => done(null, body),
    );

    // One-click, from the List-Unsubscribe header. Mail providers post here
    // without a browser, so there's no Origin to check; the token is the
    // whole authority, as the RFC intends. Request logs hide it (logger.ts).
    scope.post<{ Params: { token: string } }>("/unsubscribe/:token", LIMIT, async (request, reply) => {
      const outcome = setSubscribed(db, request.params.token, false, "one-click from their mail app", request.log);
      if (!outcome) return reply.code(404).send({ error: "This unsubscribe link isn't valid." });
      return reply.send(outcome);
    });

    // A mail app without one-click support opens the List-Unsubscribe
    // address in a browser. That changes nothing: it goes on to the page,
    // which asks, with the token moved after the #.
    scope.get<{ Params: { token: string } }>("/unsubscribe/:token", LIMIT, async (request, reply) => {
      const { token } = request.params;
      return reply.redirect(isUnsubscribeToken(token) ? `/unsubscribe#${token}` : "/unsubscribe", 303);
    });

    // The confirmation page: the token comes in the body, never the URL.
    scope.post("/unsubscribe", LIMIT, async (request, reply) => {
      const body = parseBody(pageSchema, request.body, reply);
      if (!body) return reply;
      const outcome = setSubscribed(db, body.token, body.subscribed, "from the link in a newsletter", request.log);
      if (!outcome) return reply.code(404).send({ error: "This unsubscribe link isn't valid." });
      return reply.send(outcome);
    });
  });
}
