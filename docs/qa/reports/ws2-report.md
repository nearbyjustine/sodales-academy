# Workstream 2 report — Form submission safety (A2, A3, E7)

Ref: `docs/qa/2026-09-05-frontend-qa.md` §A2, §A3, §E7; plan `docs/qa/plans/ws2-form-safety.md`.

## Summary

A2 (admin create/edit forms never disable their submit button), A3 (delete dialog closes
synchronously before the mutation result is known), and E7 (`GoogleButton` has no pending state)
are all fixed, following the `useTransition` + `pending` + disabled/relabelled-button +
`result.ok`/`toast.error` pattern already established by `enroll-button.tsx`. The plan was followed
closely, with two deviations discovered empirically while making the new tests genuinely fail on
revert (see "Deviations" below).

## Files changed

- `src/components/admin/course-form.tsx` — added `useTransition`, wrapped the mutation call in
  `startTransition`, disabled/relabelled the submit button (`"Saving…"`). Also added a
  `if (pending) return;` guard at the top of `handleSubmit` (deviation, see below). No other part
  of the file touched (no `<h1>`/width changes, per the constraint for the other workstream's
  later layout edit).
- `src/components/admin/track-form.tsx` — identical shape, for `createTrack`/`updateTrack`.
- `src/components/admin/course-row-actions.tsx` — controlled `Dialog` (`deleteOpen`/
  `onOpenChange={handleDeleteDialogOpenChange}`), `deletePending` via `useTransition`, Delete
  button pulled off `DialogClose` and turned into a plain `Button` calling `handleDelete`.
  `onOpenChange` refuses to close while a delete is pending, so Cancel/Escape/backdrop/the built-in
  `X` are all blocked mid-delete. On success, `setDeleteOpen(false)` closes the dialog explicitly;
  on failure, the dialog is left open and `toast.error(result.message)` surfaces the reason.
  `handleTogglePublish` reproduced unchanged, just relocated below the new state hooks.
- `src/components/admin/track-row-actions.tsx` — identical shape, for `deleteTrack`/`trackTitle`.
- `src/components/auth/google-button.tsx` — added `useTransition`; `handleClick` now wraps the
  dynamic `import()` + `authClient.signIn.social(...)` call in `startTransition`; button disables
  and reads "Redirecting…" while pending (in addition to the existing `disabled` prop).
- `src/components/admin/course-form.test.tsx` (new) — 1 test.
- `src/components/admin/track-form.test.tsx` (new) — 1 test.
- `src/components/admin/course-row-actions.test.tsx` (new) — 3 tests.
- `src/components/admin/track-row-actions.test.tsx` (new) — 3 tests.
- `docs/qa/reports/ws2-report.md` (this file, new).

No changes to `src/lib/content/mutations.ts`, `authz.ts`, or any schema/migration.

## Tests added — 8 new, all passing

```
✓ track-form.test.tsx > TrackForm > disables and relabels the submit button while updateTrack is in flight
✓ course-form.test.tsx > CourseForm > disables and relabels the submit button while updateCourse is in flight
✓ track-row-actions.test.tsx > TrackRowActions — delete dialog > stays open with the reason surfaced when the delete fails
✓ track-row-actions.test.tsx > TrackRowActions — delete dialog > closes and refreshes the list when the delete succeeds
✓ track-row-actions.test.tsx > TrackRowActions — delete dialog > ignores Escape and Cancel while a delete is in flight
✓ course-row-actions.test.tsx > CourseRowActions — delete dialog > stays open with the reason surfaced when the delete fails
✓ course-row-actions.test.tsx > CourseRowActions — delete dialog > closes and refreshes the list when the delete succeeds
✓ course-row-actions.test.tsx > CourseRowActions — delete dialog > ignores Escape and Cancel while a delete is in flight

 Test Files  4 passed (4)
      Tests  8 passed (8)
```

No automated test for E7 (`GoogleButton`), per the plan's own reasoning: no `MutationResult`, no
branching logic to protect, and the dynamic `import()` would need extra mock surface for a single
boolean check. Verified manually instead (button disables + relabels to "Redirecting…" on click).

## Revert-and-observe evidence — the dialog test (the most valuable test here)

Per the task instructions, I reverted `course-row-actions.tsx`'s fix back to the original A3 bug
(uncontrolled `<Dialog>`, Delete button wrapped in `DialogClose`) and re-ran
`course-row-actions.test.tsx` to confirm the "stays open ... when the delete fails" test genuinely
fails without the fix, then restored the fix and confirmed it passes again.

**Reverted (bug reintroduced) — 2 of 3 tests fail:**

```
 × CourseRowActions — delete dialog > stays open with the reason surfaced when the delete fails
 ✓ CourseRowActions — delete dialog > closes and refreshes the list when the delete succeeds
 × CourseRowActions — delete dialog > ignores Escape and Cancel while a delete is in flight

 Test Files  1 failed (1)
      Tests  2 failed | 1 passed (3)
```

The failing assertion for the primary test was `screen.getByRole("dialog")` throwing — the dialog
was gone from the DOM immediately after the click, before `deleteCourse`'s rejection was even
known, exactly reproducing A3.

**Restored (fix back in place) — all 3 pass:**

```
 ✓ CourseRowActions — delete dialog > stays open with the reason surfaced when the delete fails  102ms
 ✓ CourseRowActions — delete dialog > closes and refreshes the list when the delete succeeds       40ms
 ✓ CourseRowActions — delete dialog > ignores Escape and Cancel while a delete is in flight         41ms

 Test Files  1 passed (1)
      Tests  3 passed (3)
```

Confirmed via `diff` against a backup copy that the restored file is byte-identical to the
fixed version before the revert experiment.

## Verification — all four commands, real output

### `pnpm typecheck`

```
$ tsc --noEmit
```
Exit 0, no output — no type errors, including the four new `*.test.tsx` files.

### `pnpm lint`

```
$ eslint .

/Users/justine/Documents/sodales/src/components/layout/sign-out-button.tsx
  10:5  warning  Do not use `window.location.href` to navigate to internal Next.js pages. ...
  @next/next/no-location-assign-relative-destination

/Users/justine/Documents/sodales/src/lib/content/queries.ts
  110:20  warning  '_modules' is assigned a value but never used  @typescript-eslint/no-unused-vars

✖ 2 problems (0 errors, 2 warnings)
```
Exactly the two known pre-existing warnings — no new warnings from any of the nine files
touched/added.

### `pnpm test`

```
 RUN  v4.1.11 /Users/justine/Documents/sodales

 Test Files  22 passed (22)
      Tests  138 passed (138)
```
Full suite green: 138 = 130 pre-existing (per ws1's report) + 8 new. No regressions.

### `pnpm build`

```
▲ Next.js 16.3.4 (Turbopack)
✓ Compiled successfully
✓ Running TypeScript
✓ Generating static pages using 14 workers (16/16)
  Finalizing page optimization ...

Route (app)                                  ... (all 19 routes listed, all ƒ or ○)
ƒ Proxy (Middleware)
```
Exit 0. The `[neon-auth] Cookie validation error ... Dynamic server usage` lines during static-page
generation for `/admin/*` and other session-reading routes are the documented, expected behavior
(every route is dynamic because the root layout reads the session) — not build errors.

## Deviations from the plan

1. **Test fixture UUID was invalid; fixed.** The plan's `course-form.test.tsx` fixture used
   `instructorUserId: "11111111-1111-1111-1111-111111111111"`. `courseInputSchema`'s
   `z.string().uuid()` enforces the strict RFC-4122 pattern (version nibble `[1-8]`, variant nibble
   `[89abAB]`), and `...-1111-...` fails the variant check. With the invalid fixture,
   `courseInputSchema.safeParse` failed validation, `handleSubmit` returned early before ever
   calling `startTransition`, and the test's `waitFor(() => getByRole("button", { name: "Saving…" }))`
   timed out for the wrong reason (validation failure, not the A2 defect). Changed the fixture to
   `"11111111-1111-4111-8111-111111111111"` (valid v4-shaped UUID). Confirmed via a standalone
   `courseInputSchema.safeParse` check that the original literal from the plan does fail zod's
   validation.
2. **Added a `if (pending) return;` guard to both forms' `handleSubmit`, not in the plan's literal
   code.** The plan's Step 3/4 tests fire a second `fireEvent.submit(form)` while pending and assert
   the mutation was called only once. `fireEvent.submit` dispatches a submit event directly on the
   `<form>` element, which invokes React's `onSubmit` handler regardless of the submit button's
   `disabled` attribute — unlike a real second click on a disabled button (which browsers block
   natively) or Enter-key implicit submission (which requires an enabled submit button per the HTML
   spec), a raw `fireEvent.submit` bypasses the disabled-button protection entirely. Without an
   explicit re-entrancy guard in `handleSubmit` itself, `startTransition` would fire a second,
   independent transition and call `updateCourse`/`updateTrack` again, failing the test's
   `toHaveBeenCalledTimes(1)` assertion. Added `if (pending) return;` as the first line of
   `handleSubmit` in both files (after `event.preventDefault()`) so the guard holds even under a
   more aggressive trigger than a literal click, which is strictly stronger protection than what the
   plan's code alone provides and is consistent with A2's stated goal.
3. **Row-actions tests open the dropdown trigger with `fireEvent.click`, not
   `fireEvent.mouseDown`.** The plan predicted (from reading `MenuTrigger.js`'s `useClick` config)
   that only `mousedown` opens the menu. Empirically, against the installed `@base-ui/react@1.7.0`
   in this jsdom/Testing Library environment, `fireEvent.mouseDown` alone does **not** open the
   menu (`queryAllByRole("menuitem")` returns 0 items), while a plain `fireEvent.click` does (3
   items). This was confirmed by direct comparison across several event combinations
   (`mousedown`, `pointerdown`, `pointerdown+mousedown+pointerup+mouseup`, all → 0 items;
   `click` alone → 3 items). Updated `openDeleteConfirmation()` in both row-actions test files to
   use `fireEvent.click` on the trigger, per the plan's own documented fallback ("the fallback is
   ... `fireEvent.click` after both"). Left an inline comment recording the empirical finding.

None of these deviations change the production code's behavior beyond the added re-entrancy guard
(deviation 2), which is a strict tightening of A2's fix, not a scope change.

## Concerns

- The added `if (pending) return;` guard is a small addition beyond the plan's literal
  `handleSubmit` code. It's low-risk (pending is only ever true while a submission is genuinely in
  flight) and makes the double-submit protection robust to both real double-clicks (already
  blocked by `disabled`) and synthetic/programmatic re-submission, but flagging it explicitly since
  the task asked to follow the plan exactly and this is one place where the literal code as written
  would not have passed its own test.
- The row-actions tests' `openDeleteConfirmation` helper depends on `@base-ui/react@1.7.0`'s exact
  event handling in jsdom, same caveat the plan itself already called out for a future
  `@base-ui/react` upgrade — only the specific event name differs from what the plan predicted
  (`click` in practice vs. `mousedown` predicted from source reading).
- `publishCourse`/`unpublishCourse`/`publishTrack`/`unpublishTrack` were left untouched, per the
  plan — they already return `MutationResult` and already branch on `result.ok`/`toast.error`.
