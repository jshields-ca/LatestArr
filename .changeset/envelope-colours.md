---
"@latestarr/web": minor
---

**Improved:** A new look for the app: airmail colours on paper, with a navy sidebar.

- **Light theme:** cream paper with near-white cards and navy text, in place of the pink tint. **Dark theme:** deep navy.
- **A navy sidebar** in both themes, and in the phone menu.
- **An airmail stripe** under the header on every page.
- **Two colours with jobs:** rose marks the main action and where you are; blue is for links, information and keyboard focus. Green, amber and red are now only used for status.
- **Easier to read:** field and button outlines are stronger, and red error text and the Sent badge have more contrast.

<details>
<summary>Technical details</summary>

The "Envelope" direction from the UI review (#332). `index.css` has new values for every token in both themes; `--tertiary` is now airmail blue and `--ring` uses it, so focus can't be mistaken for a selected or primary item. `--input` clears 3:1 against cards, and each text pair clears 4.5:1. In the dark theme `--destructive` is a light red with dark text on it, the way `--primary` works there. New: `--sidebar*` tokens, a `.surface-navy` class that redefines the semantic tokens for anything placed on navy (the sidebar and the phone menu's sheet), and `.airmail-stripe`. The shell is full width, with the sidebar at the left edge and the page content and footer in a centred column beside it. The dashboard's tiles use one neutral icon chip, the Recent sends card is a plain card, and the `accent` badge is tinted blue; the violet, sky and amber decoration is gone. `theme-color` is the navy. The grouped sidebar, sign-in page and bundled fonts follow separately.

</details>
