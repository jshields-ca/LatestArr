## Summary

<!-- What does this PR change, and why? -->

## Related issue(s)

<!-- Fixes #... / Refs #... -->

## What else this affects

<!-- What else uses what you changed: a value, a limit, a default, a function, an API field? Search for it.
     List what you found and how it's covered (a test, or why it's unaffected). "Nothing else" is a fine answer once you've looked. -->

## Checklist

- [ ] `pnpm turbo run lint typecheck build test` passes locally
- [ ] A test covers the change. For a bug fix, the test fails without the fix.
- [ ] Docs updated (README, CONTRIBUTING, `docs/`, `.env.example`) if user-facing behaviour changed
- [ ] For UI changes: works by keyboard, and no new axe-core violations
- [ ] For new or changed source adapters: test data is copied from the real app's output or source, not invented

**Security** (see "Testing and review" in CONTRIBUTING.md). Tick each that applies, and say how it's handled:

- [ ] Handles data from a source, a recipient, an import or a request (escaped, validated, URL schemes checked)
- [ ] Adds or changes an API route (sign-in and role required; the route test in `security.test.ts` covers it)
- [ ] Makes outbound requests (timeout and size limits; admin-only targets)
- [ ] Touches credentials, sessions, sign-in or secrets (never logged or returned; encrypted at rest)
- [ ] None of the above

**Behaviour changes** (limits, fetching, sending, links, sources, auth):

- [ ] Reviewed with a second pass (e.g. `/code-review`, and `/security-review` if a security box above is ticked)
- [ ] Tried on `:dev` with a real newsletter send before the release is cut
