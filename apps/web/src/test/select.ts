import { fireEvent, screen } from "@testing-library/react";

/**
 * Chooses an option in one of this app's Radix-based <Select>s.
 *
 * Unlike a native <select>, `userEvent.selectOptions()` doesn't work here:
 * the trigger is a button that opens a listbox popover on click, and the
 * option itself is a `role="option"` element inside it. This dispatches
 * the same pointerdown/pointerup/click sequence Radix's Trigger and Item
 * listen for, via `fireEvent`, rather than `userEvent.click()` — under
 * jsdom, `userEvent`'s hover simulation makes each click on a Radix
 * Select noticeably slower to settle (still correct, just slow), which
 * compounds badly once a form has more than one dropdown.
 */
export function selectOption(trigger: HTMLElement, optionName: string | RegExp) {
  clickViaPointerEvents(trigger);
  const option = screen.getByRole("option", { name: optionName });
  clickViaPointerEvents(option);
}

function clickViaPointerEvents(element: HTMLElement) {
  const opts = { button: 0, pointerId: 1, pointerType: "mouse" } as const;
  fireEvent.pointerDown(element, opts);
  fireEvent.pointerUp(element, opts);
  fireEvent.click(element, { button: 0 });
}
