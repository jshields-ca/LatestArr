import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Select } from "./select";
import { openSelect, selectOption } from "@/test/select";

function Fruit({ disabled, onChange }: { disabled: boolean; onChange: (value: string) => void }) {
  return (
    <fieldset disabled={disabled}>
      <Select aria-label="Fruit" value="apple" onChange={(e) => onChange(e.target.value)}>
        <option value="apple">Apple</option>
        <option value="pear">Pear</option>
      </Select>
    </fieldset>
  );
}

describe("Select", () => {
  it("changes value when its form is editable", () => {
    const onChange = vi.fn();
    render(<Fruit disabled={false} onChange={onChange} />);
    selectOption(screen.getByRole("combobox", { name: "Fruit" }), "Pear");
    expect(onChange).toHaveBeenCalledWith("pear");
  });

  // A viewer's read-only form is a disabled <fieldset>, which Radix's
  // pointerdown handler doesn't otherwise respect.
  it("doesn't open inside a disabled fieldset", () => {
    const onChange = vi.fn();
    render(<Fruit disabled onChange={onChange} />);
    openSelect(screen.getByRole("combobox", { name: "Fruit" }));
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
