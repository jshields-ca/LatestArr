import { describe, expect, it } from "vitest";
import { checkCodeTemplate } from "./code-template.js";

const wrap = (body: string) => `<mjml>\n<mj-body>\n${body}\n</mj-body>\n</mjml>`;

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
