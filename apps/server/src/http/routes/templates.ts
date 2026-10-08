import { getAdapter } from "@latestarr/adapter-core";
import { type Db, designImages, newsletters, sourceConnections, templates } from "@latestarr/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  cleanImage,
  MAX_UPLOAD_BYTES,
  pruneUnusedDesignImages,
  resolveLogo,
  UnsupportedImageError,
} from "../../pipeline/design-logo.js";
import {
  describeSendFailure,
  inlineAttachments,
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

// An uploaded image, as base64. Its size is checked once decoded.
const uploadImageSchema = z.object({
  data: z.string().min(1).max(Math.ceil(MAX_UPLOAD_BYTES / 3) * 4 + 4),
});
// Room for the base64 image plus the JSON around it.
const UPLOAD_BODY_LIMIT = Math.ceil(MAX_UPLOAD_BYTES / 3) * 4 + 1024;

function codeErrorReply(check: CodeCheck) {
  const [first] = check.errors;
  return { error: `Line ${first!.line}: ${first!.message}`, issues: check };
}

interface IdParams {
  id: string;
}

export function registerTemplateRoutes(app: FastifyInstance, db: Db): void {
  void app.register(async (scope) => {
    scope.addHook("preHandler", requireAuth(db, { read: "viewer", write: "editor" }));

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
    scope.post("/templates/preview", { config: { minRole: "viewer" } }, async (request, reply) => {
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
        const sources = await db
          .select({ kind: sourceConnections.kind, name: sourceConnections.name, publicUrl: sourceConnections.publicUrl })
          .from(sourceConnections);
        const logo = await resolveLogo(db, settings, { fetchUrls: false, log: request.log });
        const html = await renderDesignSample(
          settings,
          mjml,
          sources.map((source) => ({ ...source, kinds: getAdapter(source.kind)?.capabilities.supportsMediaKinds ?? [] })),
          logo.logo,
        );
        return reply.send({ subject: "Sample newsletter", html: inlineAttachments(html, logo.attachments), items: [], warnings });
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

    // A logo for a design (#302). The image is checked and cleaned up
    // (cleanImage) before it's stored; the design then refers to it by id.
    scope.post("/templates/images", { bodyLimit: UPLOAD_BODY_LIMIT }, async (request, reply) => {
      const body = parseBody(uploadImageSchema, request.body, reply);
      if (!body) return reply;
      const bytes = Buffer.from(body.data, "base64");
      if (bytes.length === 0) return reply.code(400).send({ error: "The image is empty" });
      if (bytes.length > MAX_UPLOAD_BYTES) {
        return reply.code(413).send({ error: "Images can be up to 1 MB. Try a smaller or more compressed version." });
      }
      let image;
      try {
        image = await cleanImage(bytes);
      } catch (err) {
        if (err instanceof UnsupportedImageError) return reply.code(422).send({ error: err.message });
        throw err;
      }
      const [row] = await db
        .insert(designImages)
        .values({ ...image, createdBy: request.sessionUser?.id ?? null })
        .returning({ id: designImages.id, contentType: designImages.contentType, width: designImages.width, height: designImages.height });
      request.log.info({ imageId: row!.id, bytes: image.content.length }, "Uploaded a design image");
      await pruneUnusedDesignImages(db);
      return reply.code(201).send({ image: row });
    });

    // Images never change (a new upload gets a new id), so browsers can
    // keep them.
    scope.get<{ Params: IdParams }>("/templates/images/:id", async (request, reply) => {
      const [image] = await db.select().from(designImages).where(eq(designImages.id, request.params.id));
      if (!image) return reply.code(404).send({ error: "Not found" });
      return reply
        .type(image.contentType)
        .header("cache-control", "private, max-age=31536000, immutable")
        .header("content-disposition", "inline")
        .send(image.content);
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
      if (settings !== undefined) await pruneUnusedDesignImages(db);
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
          compiledMjml: buildDesignMjml(parseDesignSettings(existing.settings), { darkModeMarker: true }).trim(),
          updatedAt: new Date(),
        })
        .where(eq(templates.id, existing.id))
        .returning();
      request.log.info({ templateId: template!.id }, `Switched design "${template!.name}" to code`);
      return reply.send({ template });
    });

    scope.delete<{ Params: IdParams }>("/templates/:id", async (request, reply) => {
      // Newsletters using this design go back to Default rather than
      // blocking the delete (the web app says so before confirming).
      const { deleted, switched } = db.transaction((tx) => {
        const switched = tx
          .update(newsletters)
          .set({ templateId: null, updatedAt: new Date() })
          .where(eq(newsletters.templateId, request.params.id))
          .returning({ name: newsletters.name })
          .all();
        const [deleted] = tx.delete(templates).where(eq(templates.id, request.params.id)).returning().all();
        return { deleted, switched };
      });
      if (deleted) {
        await pruneUnusedDesignImages(db);
        request.log.info(
          { templateId: deleted.id, switchedToDefault: switched.map((n) => n.name) },
          `Deleted design "${deleted.name}"${switched.length > 0 ? `; ${switched.length} newsletter(s) now use Default` : ""}`,
        );
      }
      return reply.code(204).send();
    });
  });
}
