import { describe, expect, it } from "vitest";

import { DEFAULT_DESIGN_SETTINGS, withDesignDefaults } from "./design";

describe("withDesignDefaults", () => {
  // #390: designs saved before Wording existed, or with only some names set.
  it("fills in Wording for an older design, and keeps the names a design has", () => {
    expect(withDesignDefaults({ layout: "grid" }).wording).toEqual(DEFAULT_DESIGN_SETTINGS.wording);
    const partial = withDesignDefaults({
      wording: { dateOrder: "dayFirst", sectionNames: { movie: { plural: "Films", singular: "" } } },
    } as never);
    expect(partial.wording.dateOrder).toBe("dayFirst");
    expect(partial.wording.sectionNames.movie).toEqual({ plural: "Films", singular: "" });
    expect(partial.wording.sectionNames.tv).toEqual({ plural: "", singular: "" });
  });
});
