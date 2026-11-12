---
"@latestarr/web": minor
---

**Improved:** A new look for the sign-in page and the other signed-out pages.

- The stamp sits above the name at a slight tilt, with a postmark showing today's date beside it, and the airmail stripe runs along the top of the card.
- On the sign-in and setup pages, the stamp presses onto the page once as it opens. It doesn't repeat, and it's skipped if your system asks for reduced motion.
- Setup, forgotten password, reset password and the temporary-password screen share the same card.
- Each of these pages now has a proper heading and its own browser-tab name, for screen readers and keyboard users.

<details>
<summary>Technical details</summary>

From the UI review (#332): the L3 postmark and L6 press. A new `AuthCard` (`components/auth-card.tsx`) holds what `login-page`, `setup-page`, `forgot-password-page`, `reset-password-page` and `change-password-screen` each repeated. It renders a `main`, an `h1` (visually hidden on sign-in and setup, where the description says it), and calls `usePageTitle`, which finishes audit finding 10 for these pages. `.stamp-tilt`, `.stamp-press` and `.postmark-in` are in `index.css`; they use `transform` so the keyframes and the resting tilt are one property, and `prefers-reduced-motion` switches the animations off. The postmark is `aria-hidden`.

</details>
