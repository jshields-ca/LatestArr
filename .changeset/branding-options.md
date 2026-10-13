---
"@latestarr/server": minor
"@latestarr/web": minor
---

**New:** More colour and button options for designs, under **Colours and font** and **Buttons** in the design editor.

- **More colours:** choose your own colours for type labels (text and background) and for links in the intro and footer note, and under **Buttons**, the button colour and button text. Each follows the accent until you set it, and the × puts it back, so existing designs, Default included, look exactly as before. Custom label and link colours get dark-mode versions too.
- **Button style:** rounded, square or pill shape, regular or small, for every button. Your own buttons and "Where to watch" buttons can each be filled or outlined.
- **Contrast check:** the editor warns when a colour pair would be hard to read (below WCAG AA, 4.5:1). It doesn't stop you saving.

<details>
<summary>Technical details</summary>

- Closes #293.
- **Settings:**
  - `colors` gains `labelText`, `labelBackground`, `buttonBackground`, `buttonText` and `link`, as nullable hex values defaulting to `null`, which means they follow the accent.
  - New `buttons: { shape, style, size }`, defaulting to `rounded`, `filled` and `regular`.
- **`paletteFor`** works out the label, button and link colours, matching today's output when they're unset. The default-design snapshot is unchanged.
- **`darkPaletteFor` and `darkModeHead`** add dark rules only for custom colours that differ from those already covered. Buttons keep their colours in dark mode, as before.
- **`button()`** takes the button settings:
  - shape sets `border-radius` to 0, 8 or 999 px;
  - size sets the padding and font size, with outlined buttons losing 1 px of padding to their border;
  - an outlined primary button uses the background and button colour.
  - `mj-button` keeps all of this working in Outlook.
- **Notes' links** use `colors.link`, falling back to the accent.
- **Web:** `lib/colour.ts` has `mix`, `contrastRatio`, `effectiveColour` and `contrastWarnings`. The editor gains `AdvancedColours`, `ButtonStyle` and `ContrastNotes`.

</details>
