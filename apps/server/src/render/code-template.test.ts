import { describe, expect, it } from "vitest";
import { checkCodeTemplate, withoutHandlebars } from "./code-template.js";

const wrap = (body: string) => `<mjml>\n<mj-body>\n${body}\n</mj-body>\n</mjml>`;

describe("withoutHandlebars", () => {
  it("blanks each {{...}}, keeping line breaks and everything around it", () => {
    expect(withoutHandlebars("<p>{{a}}</p>")).toBe("<p>     </p>");
    expect(withoutHandlebars("x{{#if a}}\n{{/if}}y")).toBe("x         \n       y");
    // Each token ends at the first "}}", as the regex it replaced did.
    expect(withoutHandlebars("{{}}{{{b}}}")).toBe("          }");
    // An opening with no close after it is left as it is.
    expect(withoutHandlebars("a {{ b")).toBe("a {{ b");
    expect(withoutHandlebars("{{a}} {{ b")).toBe("      {{ b");
  });

  it("blanks exactly what the regex it replaced did", () => {
    const regex = (s: string) => s.replace(/\{\{[\s\S]*?\}\}/g, (token) => token.replace(/[^\n]/g, " "));
    const parts = ["{", "}", "{{", "}}", "a", "\n", " "];
    let seed = 7;
    const next = () => (seed = (seed * 48271) % 2147483647);
    for (let n = 0; n < 2000; n++) {
      const s = Array.from({ length: next() % 30 }, () => parts[next() % parts.length]).join("");
      expect(withoutHandlebars(s)).toBe(regex(s));
    }
  });

  // Code scanning: the regex this replaced took time that grew with the
  // square of a long run of "{{" with no "}}" after it.
  it("stays quick on a long run of openings with no close", () => {
    const source = "{{".repeat(100_000);
    const started = performance.now();
    expect(withoutHandlebars(source)).toBe(source);
    expect(performance.now() - started).toBeLessThan(200);
  });
});

describe("checkCodeTemplate", () => {
  it("passes valid MJML with Handlebars blocks and attributes", async () => {
    const source = wrap(
      '<mj-section><mj-column>\n{{#each ctas}}<mj-button href="{{url}}">{{label}}</mj-button>{{/each}}\n</mj-column></mj-section>',
    );
    expect(await checkCodeTemplate(source)).toEqual({ errors: [], warnings: [] });
  });

  it("names a mismatched block close and its line", async () => {
    const check = await checkCodeTemplate(wrap("{{#each items}}\n{{title}}\n{{/if}}"));
    expect(check.errors).toEqual([{ line: 3, message: "{{/if}} closes a {{#each}} block." }]);
  });

  it("reports an unreadable Handlebars tag by line, in plain words", async () => {
    const check = await checkCodeTemplate(wrap("<mj-section>\n{{#each items}\n</mj-section>"));
    expect(check.errors).toHaveLength(1);
    expect(check.errors[0]!.line).toBe(4);
    expect(check.errors[0]!.message).toBe("A {{ }} tag on this line isn't valid. Check its braces and quotes.");
  });

  it("keeps MJML warnings on the right line when Handlebars tags span lines", async () => {
    const check = await checkCodeTemplate(
      wrap('<mj-section><mj-column>\n{{#if\n  introText}}\n<mj-text nope="1">{{introText}}</mj-text>\n{{/if}}\n</mj-column></mj-section>'),
    );
    expect(check).toEqual({ errors: [], warnings: [{ line: 6, message: "Attribute nope is illegal" }] });
  });

  it("treats markup MJML can't render at all as an error", async () => {
    const check = await checkCodeTemplate("<mjml></mjml>");
    expect(check.errors[0]!.message).toMatch(/Malformed MJML/);
  });
});
