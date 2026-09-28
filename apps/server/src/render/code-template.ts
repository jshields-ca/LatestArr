import Handlebars from "handlebars";
import mjml2html from "mjml";

export interface CodeIssue {
  line: number;
  message: string;
}

export interface CodeCheck {
  /** Stop the template from rendering at all, so it can't be saved. */
  errors: CodeIssue[];
  /** MJML's own validation: the email still renders, but a tag or
   * attribute is likely wrong. */
  warnings: CodeIssue[];
}

function handlebarsIssue(err: unknown): CodeIssue {
  const message = err instanceof Error ? err.message : String(err);
  const [first = ""] = message.split("\n");
  const parseLine = /^Parse error on line (\d+):/.exec(first);
  if (parseLine) {
    // Handlebars follows this with a caret diagram and the parser's
    // expected-token list, which reads as noise outside its source.
    return { line: Number(parseLine[1]), message: "A {{ }} tag on this line isn't valid. Check its braces and quotes." };
  }
  // e.g. "each doesn't match if - 2:3"
  const mismatch = /^(\S+) doesn't match (\S+) - (\d+):\d+$/.exec(first);
  if (mismatch) {
    return { line: Number(mismatch[3]), message: `{{/${mismatch[2]}}} closes a {{#${mismatch[1]}}} block.` };
  }
  const lineNumber = (err as { lineNumber?: number }).lineNumber;
  return { line: lineNumber ?? 1, message: first };
}

// Blanks out every {{...}} (keeping line breaks), so MJML's validator sees
// the markup around the Handlebars tokens with its line numbers intact.
function withoutHandlebars(source: string): string {
  return source.replace(/\{\{[\s\S]*?\}\}/g, (token) => token.replace(/[^\n]/g, " "));
}

/**
 * Checks a code-mode design before it is saved or previewed. A Handlebars
 * syntax error is an error (the template can't render); MJML's complaints
 * are warnings, since a send still renders best-effort HTML.
 */
export async function checkCodeTemplate(source: string): Promise<CodeCheck> {
  try {
    Handlebars.precompile(source);
  } catch (err) {
    return { errors: [handlebarsIssue(err)], warnings: [] };
  }

  const markup = withoutHandlebars(source);
  const wrapped = /^\s*<mjml[\s>]/.test(markup) ? markup : `<mjml><mj-body>${markup}</mj-body></mjml>`;
  try {
    const { errors } = await mjml2html(wrapped, { validationLevel: "soft" });
    return { errors: [], warnings: errors.map((e) => ({ line: e.line, message: e.message })) };
  } catch (err) {
    return { errors: [{ line: 1, message: err instanceof Error ? err.message : String(err) }], warnings: [] };
  }
}
