---
"@latestarr/web": patch
---

**Fixed:** Saving a template no longer briefly rebuilds the entire editor canvas behind the scenes (harmless today, but wasteful and a source of subtle glitches down the line).

<details>
<summary>Technical details</summary>

Root-caused while investigating a test that failed intermittently on CI (`template-editor-page.test.tsx`'s "warns on tab close/refresh..." test, "expected true to be false"). Two separate issues, found via instrumented reproduction rather than assumed:

1. **Real production bug**: `handleSave`'s `setTemplate(updated)` on a successful save gives `template` a new object identity every time. The GrapesJS-init `useEffect` was keyed on `[template]`, so this retriggered it — and a dependency-array change always runs the *previous* run's cleanup (`editor.destroy()`, `editorRef.current = null`) before the new run's own `editorRef.current` guard is even evaluated, so the guard couldn't prevent it. Every save destroyed and fully reinitialized the GrapesJS editor (confirmed via an instrumented test run: `mockInit` called twice, `destroy` called once, for a single save). Fixed by keying the effect on `Boolean(template)` instead — true exactly once, on the null-to-loaded transition — which matches the effect's actual intent ("initialize once, when data first arrives") without discarding the canvas on every subsequent save. Added a regression assertion (`mockInit`/`mockEditor.destroy` call counts) to the existing save test.

2. **Real test-helper race** (this was the CI flake's actual cause, confirmed by reproducing it locally — 2 failures in 60 runs before the fix, 0 in 80 after): `simulateEditorContentChange()` fired GrapesJS's mocked content-change handlers immediately after `await screen.findByText("Weekly Digest")` resolved. But `findByText`'s MutationObserver-based resolution isn't guaranteed to happen after *every* passive effect from the same commit has flushed — the GrapesJS-init effect (which registers the content-change handler at all) is a separate, independently-scheduled effect, so `contentChangeHandlers` could still be empty at that point, making the simulated "edit" a silent no-op. Fixed by having the shared test helper itself wait for a handler to actually be registered before firing it, rather than relying on each call site to remember to check — the same synchronization other tests in this file already used for `mockInit`, just not applied here.

</details>
