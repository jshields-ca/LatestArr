---
"@latestarr/server": minor
"@latestarr/web": minor
---

**Improved:** The design editor is easier to work through, and button styles now reach every button.

- **Where to watch buttons can be filled:** Watch on Plex and Browse movies buttons get their own **Style**. It defaults to Outlined, as they've always been, so existing designs look the same until you change it. Before, Style, Button colour fill, and Button text only affected buttons you added yourself, so a design without its own buttons showed no change.
- **One place for buttons:** a new **Buttons** section has your buttons (with where they go and their style), Where to watch buttons (on or off, where they go and their style), and the look of all buttons: shape, size, Button colour, and Button text.
- **In the order of the email:** Colours and font, Logo, Layout, Text, Buttons, Item details, Sections, and Custom CSS. The date range and counts line moved to Layout, and the intro and footer note share a Text section.
- **Easy to review:** each section's header says what's set, like "Cards", "Intro, Footer note", or "6 of 6 shown", so you can check a design without opening everything.
- **Contrast warnings** for buttons now show with the button options, and check whichever styles are in use.

<details>
<summary>Technical details</summary>

- Closes #330, from release testing in #281.
- **Server:** `buttons.sourceStyle` (`"filled" | "outline"`, default `"outline"`) in the design settings schema. `button()` uses `style` for the design's own buttons and `sourceStyle` for source buttons and the library link. Saved designs without it get the default, so they render as before.
- **Web:** `Section` takes a `summary`. New `Group`, `ColourField`, `AccentColours`, and `ChoiceField` components replace `AdvancedColours` and `ButtonStyle`. Fields that share a visible label ("Where they go", "Style") get distinct accessible names. `contrastWarnings` marks button warnings and checks both filled and outlined pairs when both styles are in use.

</details>
