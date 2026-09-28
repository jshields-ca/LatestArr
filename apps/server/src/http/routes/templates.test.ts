import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb, runMigrations, type Db } from "@latestarr/db";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";

let dir: string;
let db: Db;
let app: FastifyInstance;
let sessionCookie: string;

function extractSessionCookie(response: { headers: Record<string, unknown> }): string {
  const raw = response.headers["set-cookie"];
  const cookieHeader = Array.isArray(raw) ? raw[0] : raw;
  const match = typeof cookieHeader === "string" ? cookieHeader.match(/latestarr_session=([^;]+)/) : null;
  if (!match) throw new Error("session cookie not found in response");
  return decodeURIComponent(match[1]!);
}

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "latestarr-templates-test-"));
  db = createDb(path.join(dir, "test.db"));
  runMigrations(db);
  app = await buildApp(db);

  await app.inject({
    method: "POST",
    url: "/api/auth/bootstrap",
    payload: { email: "admin@example.com", password: "a-very-long-password", displayName: "Admin" },
  });
  const loginResponse = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@example.com", password: "a-very-long-password" },
  });
  sessionCookie = extractSessionCookie(loginResponse);
});

afterEach(async () => {
  await app.close();
  db.$client.close();
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

function authed(overrides: Record<string, unknown>) {
  return { cookies: { latestarr_session: sessionCookie }, ...overrides };
}

describe("POST /templates", () => {
  it("rejects a missing name", async () => {
    const response = await app.inject(
      authed({ method: "POST", url: "/api/templates", payload: {} }),
    );
    expect(response.statusCode).toBe(400);
  });

  it("creates a template without a designJson", async () => {
    const response = await app.inject(
      authed({ method: "POST", url: "/api/templates", payload: { name: "Weekly digest" } }),
    );
    expect(response.statusCode).toBe(201);
    expect(response.json().template.name).toBe("Weekly digest");
    expect(response.json().template.designJson).toBeNull();
  });

  it("creates a template with a designJson blob", async () => {
    const designJson = { blocks: [{ type: "header", text: "New this week" }] };
    const response = await app.inject(
      authed({ method: "POST", url: "/api/templates", payload: { name: "Weekly digest", designJson } }),
    );
    expect(response.statusCode).toBe(201);
    expect(response.json().template.designJson).toEqual(designJson);
  });

  it("creates a template with compiled MJML", async () => {
    const response = await app.inject(
      authed({
        method: "POST",
        url: "/api/templates",
        payload: { name: "Weekly digest", compiledMjml: "<mjml><mj-body></mj-body></mjml>" },
      }),
    );
    expect(response.statusCode).toBe(201);
    expect(response.json().template.compiledMjml).toBe("<mjml><mj-body></mj-body></mjml>");
  });
});

describe("template lifecycle", () => {
  async function createTemplate(designJson?: Record<string, unknown>) {
    const response = await app.inject(
      authed({ method: "POST", url: "/api/templates", payload: { name: "Weekly digest", designJson } }),
    );
    return response.json().template.id as string;
  }

  it("lists and fetches", async () => {
    const id = await createTemplate();

    const listResponse = await app.inject(authed({ method: "GET", url: "/api/templates" }));
    expect(listResponse.json().templates).toHaveLength(1);

    const getResponse = await app.inject(authed({ method: "GET", url: `/api/templates/${id}` }));
    expect(getResponse.json().template.id).toBe(id);
  });

  it("returns 404 for an unknown id on get/update", async () => {
    const getResponse = await app.inject(authed({ method: "GET", url: "/api/templates/nope" }));
    expect(getResponse.statusCode).toBe(404);

    const patchResponse = await app.inject(
      authed({ method: "PATCH", url: "/api/templates/nope", payload: { name: "x" } }),
    );
    expect(patchResponse.statusCode).toBe(404);
  });

  it("updates the name and designJson independently", async () => {
    const id = await createTemplate({ blocks: [] });

    const renamed = await app.inject(
      authed({ method: "PATCH", url: `/api/templates/${id}`, payload: { name: "Renamed" } }),
    );
    expect(renamed.json().template.name).toBe("Renamed");
    expect(renamed.json().template.designJson).toEqual({ blocks: [] });

    const newDesign = { blocks: [{ type: "footer" }] };
    const redesigned = await app.inject(
      authed({ method: "PATCH", url: `/api/templates/${id}`, payload: { designJson: newDesign } }),
    );
    expect(redesigned.json().template.name).toBe("Renamed");
    expect(redesigned.json().template.designJson).toEqual(newDesign);
  });

  it("updates compiledMjml", async () => {
    const id = await createTemplate();

    const response = await app.inject(
      authed({
        method: "PATCH",
        url: `/api/templates/${id}`,
        payload: { compiledMjml: "<mjml><mj-body></mj-body></mjml>" },
      }),
    );
    expect(response.json().template.compiledMjml).toBe("<mjml><mj-body></mj-body></mjml>");
  });

  it("deletes", async () => {
    const id = await createTemplate();
    const deleteResponse = await app.inject(authed({ method: "DELETE", url: `/api/templates/${id}` }));
    expect(deleteResponse.statusCode).toBe(204);

    const getResponse = await app.inject(authed({ method: "GET", url: `/api/templates/${id}` }));
    expect(getResponse.statusCode).toBe(404);
  });
});

describe("auth gating", () => {
  it("rejects unauthenticated requests", async () => {
    const response = await app.inject({ method: "GET", url: "/api/templates" });
    expect(response.statusCode).toBe(401);
  });
});

describe("designs", () => {
  it("creates a design from settings, filling in defaults for anything left out", async () => {
    const response = await app.inject(
      authed({ method: "POST", url: "/api/templates", payload: { name: "Dark", settings: { layout: "compact", colors: { background: "#101820" } } } }),
    );
    expect(response.statusCode).toBe(201);
    const { template } = response.json();
    expect(template.mode).toBe("design");
    expect(template.settings).toMatchObject({
      layout: "compact",
      colors: { background: "#101820", accent: "#c31d4c" },
      show: { poster: true },
    });
    expect(template.compiledMjml).toBeNull();
  });

  it("keeps a template created without settings as a code template", async () => {
    const response = await app.inject(authed({ method: "POST", url: "/api/templates", payload: { name: "Legacy" } }));
    expect(response.json().template.mode).toBe("code");
  });

  it("rejects invalid design settings", async () => {
    const badColour = await app.inject(
      authed({ method: "POST", url: "/api/templates", payload: { name: "Bad", settings: { colors: { accent: "red" } } } }),
    );
    expect(badColour.statusCode).toBe(400);
  });

  it("turns a template into a design when settings are saved", async () => {
    const created = await app.inject(authed({ method: "POST", url: "/api/templates", payload: { name: "Legacy" } }));
    const id = created.json().template.id;
    const updated = await app.inject(
      authed({ method: "PATCH", url: `/api/templates/${id}`, payload: { settings: { layout: "grid" } } }),
    );
    expect(updated.json().template).toMatchObject({ mode: "design", settings: { layout: "grid" } });
  });

  it("previews unsaved settings with sample content", async () => {
    const response = await app.inject(
      authed({ method: "POST", url: "/api/templates/preview", payload: { settings: { layout: "grid" } } }),
    );
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.subject).toBe("Sample newsletter");
    expect(body.html).toContain("The Quiet Harbour");
    expect(body.html).toContain("display:inline-block;width:50%");
  });

  it("keeps a design's intro, footer note, and up to 4 buttons, and shows them in the preview", async () => {
    const ctas = [1, 2, 3, 4].map((n) => ({ label: `Link ${n}`, url: `https://example.com/${n}` }));
    const content = { intro: "Hey folks!", footerNote: "See you next week.", ctas };
    const created = await app.inject(
      authed({ method: "POST", url: "/api/templates", payload: { name: "Words", settings: { content } } }),
    );
    expect(created.statusCode).toBe(201);
    expect(created.json().template.settings.content).toEqual(content);

    const preview = await app.inject(
      authed({ method: "POST", url: "/api/templates/preview", payload: { settings: { content } } }),
    );
    expect(preview.json().html).toContain("Hey folks!");
    expect(preview.json().html).toContain("See you next week.");
    expect(preview.json().html).toContain("https://example.com/4");
  });

  it("rejects a 5th button and a button link that isn't http(s)", async () => {
    const ctas = [1, 2, 3, 4, 5].map((n) => ({ label: `Link ${n}`, url: `https://example.com/${n}` }));
    const tooMany = await app.inject(
      authed({ method: "POST", url: "/api/templates", payload: { name: "Words", settings: { content: { ctas } } } }),
    );
    expect(tooMany.statusCode).toBe(400);
    const badUrl = await app.inject(
      authed({
        method: "POST",
        url: "/api/templates",
        payload: { name: "Words", settings: { content: { ctas: [{ label: "Bad", url: "javascript:alert(1)" }] } } },
      }),
    );
    expect(badUrl.statusCode).toBe(400);
  });

  it("404s a preview against an unknown newsletter", async () => {
    const response = await app.inject(
      authed({ method: "POST", url: "/api/templates/preview", payload: { settings: {}, newsletterId: "nope" } }),
    );
    expect(response.statusCode).toBe(404);
  });
});

describe("code designs", () => {
  const CODE = `<mjml>
  <mj-body>
    <mj-section><mj-column>
      <mj-text>{{introText}}</mj-text>
      {{#each items}}<mj-text>{{title}}</mj-text>{{/each}}
    </mj-column></mj-section>
  </mj-body>
</mjml>`;

  it("previews code with the design's text, reporting MJML warnings by line", async () => {
    const withWarning = CODE.replace("<mj-text>{{introText}}", "<mj-text bogus=\"1\">{{introText}}");
    const response = await app.inject(
      authed({
        method: "POST",
        url: "/api/templates/preview",
        payload: { mjml: withWarning, settings: { content: { intro: "Hey folks!" } } },
      }),
    );
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.html).toContain("Hey folks!");
    expect(body.html).toContain("The Quiet Harbour");
    expect(body.warnings).toEqual([{ line: 4, message: "Attribute bogus is illegal" }]);
  });

  it("refuses to preview or save code with a Handlebars error, saying which line", async () => {
    const broken = CODE.replace("{{/each}}", "{{/if}}");
    const preview = await app.inject(
      authed({ method: "POST", url: "/api/templates/preview", payload: { mjml: broken } }),
    );
    expect(preview.statusCode).toBe(422);
    expect(preview.json().issues.errors[0].line).toBe(5);

    const created = await app.inject(
      authed({ method: "POST", url: "/api/templates", payload: { name: "Code", mode: "code", compiledMjml: CODE } }),
    );
    expect(created.statusCode).toBe(201);
    const saved = await app.inject(
      authed({
        method: "PATCH",
        url: `/api/templates/${created.json().template.id}`,
        payload: { compiledMjml: broken },
      }),
    );
    expect(saved.statusCode).toBe(422);
    expect(saved.json().error).toMatch(/^Line 5: /);
  });

  it("saves code and its text together without turning it back into an options design", async () => {
    const created = await app.inject(
      authed({ method: "POST", url: "/api/templates", payload: { name: "Code", mode: "code", compiledMjml: CODE } }),
    );
    const id = created.json().template.id;
    const saved = await app.inject(
      authed({
        method: "PATCH",
        url: `/api/templates/${id}`,
        payload: { mode: "code", compiledMjml: CODE, settings: { content: { footerNote: "Bye" } } },
      }),
    );
    expect(saved.json().template).toMatchObject({ mode: "code", compiledMjml: CODE, settings: { content: { footerNote: "Bye" } } });
  });

  it("switches an options design to code, starting from the markup its options produce", async () => {
    const created = await app.inject(
      authed({
        method: "POST",
        url: "/api/templates",
        payload: { name: "Dark", settings: { layout: "grid", content: { intro: "Hi" } } },
      }),
    );
    const id = created.json().template.id;
    const converted = await app.inject(authed({ method: "POST", url: `/api/templates/${id}/convert-to-code` }));
    const { template } = converted.json();
    expect(template.mode).toBe("code");
    expect(template.compiledMjml.startsWith("<mjml>")).toBe(true);
    expect(template.compiledMjml).toContain("{{introText}}");
    expect(template.settings).toMatchObject({ layout: "grid", content: { intro: "Hi" } });

    const missing = await app.inject(authed({ method: "POST", url: "/api/templates/nope/convert-to-code" }));
    expect(missing.statusCode).toBe(404);
  });
});
