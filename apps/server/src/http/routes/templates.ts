import { type Db, templates } from "@latestarr/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  describeSendFailure,
  NewsletterNotFoundError,
  previewNewsletter,
} from "../../pipeline/run-newsletter.js";
import { checkCodeTemplate, type CodeCheck } from "../../render/code-template.js";
import { buildDesignMjml, designSettingsSchema, parseDesignSettings } from "../../render/design.js";
import { renderDesignSample } from "../../render/design-sample.js";
import { changedFields } from "../log-fields.js";
import { requireAuth } from "../require-auth.js";
import { parseBody } from "../validate.js";

// Generous for hand-written MJML; the built-in design is about 15 KB.
const mjmlSchema = z.string().max(200_000);

const previewDesignSchema = z.object({
  settings: designSettingsSchema.prefault({}),
  // A code-mode design's markup; the options in `settings` are used otherwise
  // (its intro, footer note, and buttons apply either way).
  mjml: mjmlSchema.optional(),
  // Preview against this newsletter's real items; sample content otherwise.
  newsletterId: z.string().min(1).optional(),
});

const modeSchema = z.enum(["design", "code"]);

// "design" renders from `settings`; "code" from compiledMjml, with
// `settings` supplying only its intro, footer note, and buttons. Without a
// mode, sending compiledMjml makes a code design, anything else options.
const createTemplateSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  mode: modeSchema.optional(),
  settings: designSettingsSchema.optional(),
  compiledMjml: mjmlSchema.optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  mode: modeSchema.optional(),
  settings: designSettingsSchema.optional(),
  compiledMjml: mjmlSchema.optional(),
});

function codeErrorReply(check: CodeCheck) {
  const [first] = check.errors;
  return { error: `Line ${first!.line}: ${first!.message}`, issues: check };
}

interface IdParams {
  id: string;
}

export function registerTemplateRoutes(app: FastifyInstance, db: Db): void {
  void app.register(async (scope) => {
    scope.addHook("preHandler", requireAuth(db));

    scope.post("/templates", async (request, reply) => {
      const body = parseBody(createTemplateSchema, request.body, reply);
      if (!body) return reply;
      const { name, settings, compiledMjml } = body;
      const mode = body.mode ?? (compiledMjml === undefined ? "design" : "code");
      if (mode === "code" && compiledMjml) {
        const check = await checkCodeTemplate(compiledMjml);
        if (check.errors.length > 0) return reply.code(422).send(codeErrorReply(check));
      }

      const [template] = await db
        .insert(templates)
        .values({ name, mode, settings: settings ?? {}, compiledMjml: mode === "code" ? (compiledMjml ?? "") : null })
        .returning();

      request.log.info({ templateId: template!.id }, `Created template "${name}"`);
      return reply.code(201).send({ template });
    });

    // Renders design settings (saved or not), for the design editor's live
    // preview. Registered before "/templates/:id" routes; POST-only anyway.
    scope.post("/templates/preview", async (request, reply) => {
      const body = parseBody(previewDesignSchema, request.body, reply);
      if (!body) return reply;
      const { settings, mjml, newsletterId } = body;
      let warnings: CodeCheck["warnings"] = [];
      if (mjml !== undefined) {
        const check = await checkCodeTemplate(mjml);
        if (check.errors.length > 0) return reply.code(422).send(codeErrorReply(check));
        warnings = check.warnings;
      }
      if (!newsletterId) {
        const html = await renderDesignSample(settings, mjml);
        return reply.send({ subject: "Sample newsletter", html, items: [], warnings });
      }
      try {
        const preview = await previewNewsletter(db, newsletterId, { log: request.log, design: { settings, mjml } });
        return reply.send({ ...preview, warnings });
      } catch (err) {
        if (err instanceof NewsletterNotFoundError) {
          return reply.code(404).send({ error: err.message });
        }
        return reply.code(502).send({ error: describeSendFailure(err) });
      }
    });

    scope.get("/templates", async (_request, reply) => {
      const rows = await db.select().from(templates);
      return reply.send({ templates: rows });
    });

    scope.get<{ Params: IdParams }>("/templates/:id", async (request, reply) => {
      const [template] = await db.select().from(templates).where(eq(templates.id, request.params.id));
      if (!template) {
        return reply.code(404).send({ error: "Not found" });
      }
      return reply.send({ template });
    });

    scope.patch<{ Params: IdParams }>("/templates/:id", async (request, reply) => {
      const body = parseBody(updateTemplateSchema, request.body, reply);
      if (!body) return reply;
      const { name, settings, compiledMjml } = body;
      const { mode } = body;
      if (compiledMjml && mode !== "design") {
        const check = await checkCodeTemplate(compiledMjml);
        if (check.errors.length > 0) return reply.code(422).send(codeErrorReply(check));
      }

      const [template] = await db
        .update(templates)
        .set({
          ...(name !== undefined && { name }),
          ...(mode !== undefined && { mode }),
          ...(settings !== undefined && { settings }),
          ...(compiledMjml !== undefined && { compiledMjml }),
          updatedAt: new Date(),
        })
        .where(eq(templates.id, request.params.id))
        .returning();

      if (!template) {
        return reply.code(404).send({ error: "Not found" });
      }
      request.log.info({ templateId: template.id, fields: changedFields(body) }, `Saved template "${template.name}"`);
      return reply.send({ template });
    });

    // "Start from this design": turns an options-based design into code,
    // starting from exactly the markup its options produce. Its text and
    // buttons stay in `settings`, so they keep working.
    scope.post<{ Params: IdParams }>("/templates/:id/convert-to-code", async (request, reply) => {
      const [existing] = await db.select().from(templates).where(eq(templates.id, request.params.id));
      if (!existing) {
        return reply.code(404).send({ error: "Not found" });
      }
      if (existing.mode === "code") {
        return reply.send({ template: existing });
      }
      const [template] = await db
        .update(templates)
        .set({
          mode: "code",
          compiledMjml: buildDesignMjml(parseDesignSettings(existing.settings)).trim(),
          updatedAt: new Date(),
        })
        .where(eq(templates.id, existing.id))
        .returning();
      request.log.info({ templateId: template!.id }, `Switched design "${template!.name}" to code`);
      return reply.send({ template });
    });

    scope.delete<{ Params: IdParams }>("/templates/:id", async (request, reply) => {
      const [deleted] = await db.delete(templates).where(eq(templates.id, request.params.id)).returning();
      if (deleted) {
        request.log.info({ templateId: deleted.id }, `Deleted template "${deleted.name}"`);
      }
      return reply.code(204).send();
    });
  });
}
