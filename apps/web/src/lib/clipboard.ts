// Copies text, also where the clipboard API isn't offered: browsers only
// allow it on https or localhost, and LatestArr is often opened at a plain
// http:// address on the home network (#485). There, a hidden text field
// is selected and copied the older way. Throws when neither works.
export async function copyText(text: string): Promise<void> {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Refused (e.g. no permission): try the older way below.
    }
  }
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.top = "0";
  field.style.opacity = "0";
  document.body.appendChild(field);
  const focused = document.activeElement as HTMLElement | null;
  try {
    field.focus();
    field.select();
    // Deprecated, but still the only way to copy outside a secure context.
    if (!document.execCommand("copy")) throw new Error("copy was refused");
  } finally {
    field.remove();
    focused?.focus();
  }
}
