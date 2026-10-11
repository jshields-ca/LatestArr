import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SubjectField } from "./subject-field";

function Harness() {
  const [value, setValue] = useState("");
  return (
    <SubjectField id="subject" value={value} onChange={setValue} newsletterName="Weekly Digest" timeZone="UTC" lookbackDays={7} />
  );
}

describe("SubjectField", () => {
  it("inserts a variable, previews the subject, and flags a typo", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const field = screen.getByLabelText("Subject (optional)");
    expect(field).toHaveAccessibleDescription(/Blank uses the newsletter's name/);

    await user.type(field, "News for ");
    await user.click(screen.getByRole("button", { name: "Insert a variable" }));
    await user.click(await screen.findByRole("button", { name: /\{newsletter\}/ }));
    expect(field).toHaveValue("News for {newsletter}");
    expect(field).toHaveAccessibleDescription("Next subject, with example counts: News for Weekly Digest");

    // "{{" types a literal brace in user-event.
    await user.type(field, " {{dat}");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription("{dat} isn't a variable. Pick one from the list.");
  });
});
