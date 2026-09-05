# Workstream 3 — Accessibility (C1–C5)

Source: `docs/qa/2026-09-05-frontend-qa.md` §C (lines 69–91).

All five defects were confirmed present by reading the exact files/lines named in the QA doc
before writing this plan. None were already fixed. `src/components/admin/course-form.tsx:118-125`
was read and confirmed as the reference pattern for C1.

Constraints carried through every step below:
- No new colours. Focus rings use the existing `ring-violet` (`--color-violet: #5e4fb3`,
  `src/app/globals.css:19`). Dark-surface text stays `text-violet-accessible`
  (`--color-violet-accessible: #887bd8`, `src/app/globals.css:23`).
- Every write in this repo is a real write / every UI change here is a real a11y change — no
  fake/partial fixes, no invented test harness. Manual verification steps are specified per fix.

---

## Step 1 — C1: wire up `aria-describedby` + error `id`s in `modules-editor.tsx`

**File:** `src/components/admin/modules-editor.tsx`

Copy the `course-form.tsx:118-125` pattern exactly: `aria-describedby` is set to the error's `id`
only when the error exists (`undefined` otherwise, matching how `aria-invalid` already branches),
and the error `<p>` gets that same `id`. Id-naming style: reuse the same dotted key already used
for `htmlFor`/`id` on the input (e.g. `modules.${moduleIndex}.title`), suffixed with `-error` —
this mirrors `course-form.tsx`'s `title` → `title-error`.

### 1a. Module title (~lines 106–149)

Old:
```tsx
              <Input
                id={`modules.${moduleIndex}.title`}
                className="mt-1.5"
                value={mod.title}
                onChange={(e) => updateModule(moduleIndex, { title: e.target.value })}
                aria-invalid={errors[`modules.${moduleIndex}.title`] ? true : undefined}
              />
```
New:
```tsx
              <Input
                id={`modules.${moduleIndex}.title`}
                className="mt-1.5"
                value={mod.title}
                onChange={(e) => updateModule(moduleIndex, { title: e.target.value })}
                aria-invalid={errors[`modules.${moduleIndex}.title`] ? true : undefined}
                aria-describedby={
                  errors[`modules.${moduleIndex}.title`]
                    ? `modules.${moduleIndex}.title-error`
                    : undefined
                }
              />
```

Old:
```tsx
          {errors[`modules.${moduleIndex}.title`] ? (
            <p role="alert" className="mt-1 text-sm text-destructive">
              {errors[`modules.${moduleIndex}.title`]}
            </p>
          ) : null}
```
New:
```tsx
          {errors[`modules.${moduleIndex}.title`] ? (
            <p
              id={`modules.${moduleIndex}.title-error`}
              role="alert"
              className="mt-1 text-sm text-destructive"
            >
              {errors[`modules.${moduleIndex}.title`]}
            </p>
          ) : null}
```

### 1b. Lesson title (~lines 172–188)

Old:
```tsx
                      <Input
                        id={`${prefix}.title`}
                        className="mt-1.5"
                        value={lesson.title}
                        onChange={(e) =>
                          updateLesson(moduleIndex, lessonIndex, { title: e.target.value })
                        }
                        aria-invalid={errors[`${prefix}.title`] ? true : undefined}
                      />
                      {errors[`${prefix}.title`] ? (
                        <p role="alert" className="mt-1 text-sm text-destructive">
                          {errors[`${prefix}.title`]}
                        </p>
                      ) : null}
```
New:
```tsx
                      <Input
                        id={`${prefix}.title`}
                        className="mt-1.5"
                        value={lesson.title}
                        onChange={(e) =>
                          updateLesson(moduleIndex, lessonIndex, { title: e.target.value })
                        }
                        aria-invalid={errors[`${prefix}.title`] ? true : undefined}
                        aria-describedby={
                          errors[`${prefix}.title`] ? `${prefix}.title-error` : undefined
                        }
                      />
                      {errors[`${prefix}.title`] ? (
                        <p
                          id={`${prefix}.title-error`}
                          role="alert"
                          className="mt-1 text-sm text-destructive"
                        >
                          {errors[`${prefix}.title`]}
                        </p>
                      ) : null}
```

### 1c. Lesson slug (~lines 190–206)

Old:
```tsx
                      <Input
                        id={`${prefix}.slug`}
                        className="mt-1.5"
                        value={lesson.slug}
                        onChange={(e) =>
                          updateLesson(moduleIndex, lessonIndex, { slug: e.target.value })
                        }
                        aria-invalid={errors[`${prefix}.slug`] ? true : undefined}
                      />
                      {errors[`${prefix}.slug`] ? (
                        <p role="alert" className="mt-1 text-sm text-destructive">
                          {errors[`${prefix}.slug`]}
                        </p>
                      ) : null}
```
New:
```tsx
                      <Input
                        id={`${prefix}.slug`}
                        className="mt-1.5"
                        value={lesson.slug}
                        onChange={(e) =>
                          updateLesson(moduleIndex, lessonIndex, { slug: e.target.value })
                        }
                        aria-invalid={errors[`${prefix}.slug`] ? true : undefined}
                        aria-describedby={
                          errors[`${prefix}.slug`] ? `${prefix}.slug-error` : undefined
                        }
                      />
                      {errors[`${prefix}.slug`] ? (
                        <p
                          id={`${prefix}.slug-error`}
                          role="alert"
                          className="mt-1 text-sm text-destructive"
                        >
                          {errors[`${prefix}.slug`]}
                        </p>
                      ) : null}
```

### 1d. Lesson content (~lines 219–235)

Old:
```tsx
                    <Textarea
                      id={`${prefix}.content`}
                      className="mt-1.5 min-h-32"
                      value={lesson.content}
                      onChange={(e) =>
                        updateLesson(moduleIndex, lessonIndex, { content: e.target.value })
                      }
                      aria-invalid={errors[`${prefix}.content`] ? true : undefined}
                    />
                    {errors[`${prefix}.content`] ? (
                      <p role="alert" className="mt-1 text-sm text-destructive">
                        {errors[`${prefix}.content`]}
                      </p>
                    ) : null}
```
New:
```tsx
                    <Textarea
                      id={`${prefix}.content`}
                      className="mt-1.5 min-h-32"
                      value={lesson.content}
                      onChange={(e) =>
                        updateLesson(moduleIndex, lessonIndex, { content: e.target.value })
                      }
                      aria-invalid={errors[`${prefix}.content`] ? true : undefined}
                      aria-describedby={
                        errors[`${prefix}.content`] ? `${prefix}.content-error` : undefined
                      }
                    />
                    {errors[`${prefix}.content`] ? (
                      <p
                        id={`${prefix}.content-error`}
                        role="alert"
                        className="mt-1 text-sm text-destructive"
                      >
                        {errors[`${prefix}.content`]}
                      </p>
                    ) : null}
```

**Manual verification (VoiceOver or NVDA):** In `/admin/courses/new`, submit the form with an empty
module title so `courseInputSchema` fails validation. Tab to the "Module title" input. Screen
reader must announce the field as invalid AND speak the error text (e.g. "Module title, edit text,
invalid data, Title is required") — not just "invalid data" with no reason. Repeat for one lesson's
title, slug, and content fields (add a lesson, leave slug blank, submit).

---

## Step 2 — C2: reference the error in `invite-code-form.tsx`

**File:** `src/components/auth/invite-code-form.tsx`

`aria-describedby` is currently hardcoded to `"invite-code-help"` and never changes when `error` is
set, so the error text at lines 49–53 is never associated with the input. Fix: when there's an
error, describe the input by both the error and the help text (screen readers read all ids in
`aria-describedby` in order), giving the error paragraph an `id` to reference.

Old (lines 38–53):
```tsx
        <Input
          id="invite-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          disabled={verified}
          aria-invalid={error ? true : undefined}
          aria-describedby="invite-code-help"
        />
        <p id="invite-code-help" className="text-sm text-graphite">
          Members receive this from their team lead.
        </p>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
```
New:
```tsx
        <Input
          id="invite-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          disabled={verified}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "invite-code-error invite-code-help" : "invite-code-help"}
        />
        <p id="invite-code-help" className="text-sm text-graphite">
          Members receive this from their team lead.
        </p>
        {error ? (
          <p id="invite-code-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
```

**Manual verification (VoiceOver or NVDA):** On `/sign-up`, submit an invalid invite code. Tab to
the "Invite code" input (or have it re-focused after submit, whichever the form does). Screen
reader must announce the invalid state and speak the error message text, followed by (or including)
"Members receive this from their team lead." — not just the help text alone.

---

## Step 3 — C3: add the focus-ring convention to five controls

Repo convention (see `src/app/admin/layout.tsx:21`, `src/components/course/course-row.tsx:10`,
etc.): `outline-none focus-visible:ring-2 focus-visible:ring-violet`. Append it to each control's
existing `className`. Skip the `Button`/`ButtonLink` components — they already get
`focus-visible:ring-ring` from `buttonVariants` in `src/components/ui/button.tsx`; all five targets
here are raw `<Link>`/`<button>` elements that opt out of that.

### 3a. `src/components/layout/mobile-nav.tsx:50-57`

Old:
```tsx
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="label-eyebrow text-graphite hover:text-violet"
            >
```
New:
```tsx
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="label-eyebrow text-graphite outline-none hover:text-violet focus-visible:ring-2 focus-visible:ring-violet"
            >
```

### 3b. `src/app/(site)/learn/[courseSlug]/[lessonSlug]/page.tsx:34-40`

Old:
```tsx
          <Link
            href={`/courses/${courseSlug}`}
            className="label-eyebrow flex items-center gap-2 text-graphite hover:text-violet"
          >
```
New:
```tsx
          <Link
            href={`/courses/${courseSlug}`}
            className="label-eyebrow flex items-center gap-2 text-graphite outline-none hover:text-violet focus-visible:ring-2 focus-visible:ring-violet"
          >
```

### 3c. `src/app/(auth)/login/page.tsx:19-21`

Old:
```tsx
        <Link href="/sign-up" className="text-violet underline underline-offset-2">
          Create an account
        </Link>
```
New:
```tsx
        <Link
          href="/sign-up"
          className="text-violet underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-violet"
        >
          Create an account
        </Link>
```

### 3d. `src/app/(auth)/sign-up/page.tsx:19-21`

Old:
```tsx
        <Link href="/login" className="text-violet underline underline-offset-2">
          Sign in
        </Link>
```
New:
```tsx
        <Link
          href="/login"
          className="text-violet underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-violet"
        >
          Sign in
        </Link>
```

### 3e. `src/app/admin/layout.tsx:37-39` (mobile wordmark link)

Old:
```tsx
        <Link href="/admin">
          <BrandWordmark product="Academy" />
        </Link>
```
New:
```tsx
        <Link
          href="/admin"
          className="outline-none focus-visible:ring-2 focus-visible:ring-violet"
        >
          <BrandWordmark product="Academy" />
        </Link>
```
(This matches the desktop sidebar `Link` at `src/app/admin/layout.tsx:21`, which already has this
exact class.)

### 3f. `src/components/course/catalog-filters.tsx:53-67` (level filter pills)

Old:
```tsx
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => pushParams({ level: option.value === "all" ? undefined : option.value })}
              className={cn(
                "label-eyebrow shrink-0 rounded-full border px-3 py-1.5 transition-colors",
                isActive
                  ? "border-violet bg-violet text-primary-foreground"
                  : "border-border text-graphite hover:border-violet hover:text-violet",
              )}
            >
```
New:
```tsx
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => pushParams({ level: option.value === "all" ? undefined : option.value })}
              className={cn(
                "label-eyebrow shrink-0 rounded-full border px-3 py-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-violet",
                isActive
                  ? "border-violet bg-violet text-primary-foreground"
                  : "border-border text-graphite hover:border-violet hover:text-violet",
              )}
            >
```

**Manual verification (keyboard only, no screen reader needed — this is a visual/keyboard-nav
check):** For each of the six controls, Tab to it in a real browser and confirm a visible violet
ring (`#5E4FB3`) appears around it, matching the ring already visible on neighboring controls (e.g.
`admin-nav.tsx` links, `course-row.tsx` cards). Specifically:
- Open `/` on mobile width (or narrow the viewport), open the hamburger menu, Tab through "Tracks/
  Courses/Dashboard" — each shows the ring.
- On a lesson page (`/learn/<course>/<lesson>`), Tab until the "back to course" link is focused —
  ring appears.
- On `/login` and `/sign-up`, Tab to the "Create an account" / "Sign in" links — ring appears.
- On `/admin` at mobile width, Tab to the wordmark link in the top bar — ring appears.
- On `/courses`, Tab through the level pills (All/Beginner/...) — ring appears on each, including
  the active one.

---

## Step 4 — C4: expose signed-in identity to assistive tech

**File:** `src/components/layout/site-header.tsx:25-30`

**Decision:** Replace `aria-hidden="true"` with `aria-label` on the same badge, naming the signed-in
user by their full `session.name` (already available on the session object, `src/lib/session.ts:15`)
rather than just exposing the two-letter `initials` string to the accessibility tree. `initials` is
a good compact visual (e.g. "JD") but a screen reader spelling out two bare letters ("J D") tells a
blind user nothing — announcing "Signed in as Jordan Diaz" is the actual content the initials stand
in for. This does not double-announce with the adjacent `SignOutButton`, whose `aria-label` is only
`"Sign out"` (`src/components/layout/sign-out-button.tsx:14`) — the two controls announce distinct
information ("Signed in as X" vs. "Sign out button"), not the same thing twice. No visually-hidden
text or restructuring is needed because the badge is already a leaf element with no visible text
change required — `aria-label` alone is sufficient to give it an accessible name.

Old:
```tsx
              <span
                aria-hidden="true"
                className="label-eyebrow flex size-8 items-center justify-center rounded-md border border-border text-graphite"
              >
                {session.initials}
              </span>
```
New:
```tsx
              <span
                aria-label={`Signed in as ${session.name}`}
                className="label-eyebrow flex size-8 items-center justify-center rounded-md border border-border text-graphite"
              >
                {session.initials}
              </span>
```

**Manual verification (VoiceOver or NVDA):** Sign in, then Tab/navigate through the header with a
screen reader active (VoiceOver: Ctrl+Option+Right through the header; NVDA: Tab). When focus/cursor
reaches the initials badge, the screen reader must announce "Signed in as `<full name>`" — not the
bare letters, and not silence. Confirm the very next stop, the sign-out button, announces "Sign out,
button" only (no repeated "Signed in as..." text) — i.e. no double announcement.

---

## Step 5 — C5: stop dead footer links from announcing as functional

**File:** `src/components/layout/site-footer.tsx:17-32`

**Decision:** Render as non-interactive text (`<span>`), not an `aria-disabled` `<a>`. These five
items (`Main`, `Persona`, `Cinema`, `Talents`, `Store`) point at products that don't exist yet and
have no destination — `aria-disabled="true"` on a real `<a href="#">` does not stop it from being
focusable or from being announced as a link (the attribute is advisory; the browser doesn't enforce
it, and `href="#"` still navigates on click/Enter unless further JS intercepts it). Removing the
`<a>`/`href` entirely is the only way to guarantee it is neither a Tab stop nor announced as
"link" — honest for something that will never actually navigate. The `title` attribute survives
(mouse-hover tooltip is free), and a `sr-only` span (existing repo pattern, e.g.
`src/app/admin/courses/page.tsx:50`) replaces the info the invisible `title` currently fails to
convey to keyboard/screen-reader users.

Old (lines 17–32):
```tsx
        <div className="space-y-3">
          <p className="label-eyebrow text-ivory/50">Sodales products</p>
          <ul className="space-y-2">
            {SIBLING_PRODUCTS.map((product) => (
              <li key={product}>
                <a
                  href="#"
                  title={`Sodales ${product} is not yet live`}
                  className="text-sm text-violet-accessible hover:underline"
                >
                  {product}
                </a>
              </li>
            ))}
          </ul>
        </div>
```
New:
```tsx
        <div className="space-y-3">
          <p className="label-eyebrow text-ivory/50">Sodales products</p>
          <ul className="space-y-2">
            {SIBLING_PRODUCTS.map((product) => (
              <li key={product}>
                <span title={`Sodales ${product} is not yet live`} className="text-sm text-violet-accessible">
                  {product}
                  <span className="sr-only"> (coming soon)</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
```
(`hover:underline` is dropped along with `href` — nothing happens on interaction, so an underline
that implies a link would now be misleading.)

**Manual verification (VoiceOver or NVDA + keyboard):** Tab through the footer. Confirm the five
product names ("Main", "Persona", ...) are never focused and the Tab sequence skips straight from
the last real interactive element to the next section (or end of page) without stopping on them.
With a screen reader running Continuous Reading through the footer, confirm each name is announced
as plain text, e.g. "Persona, coming soon" — not "Persona, link".

---

## Step 6 — Verification

Run in order; stop and fix before proceeding if any command fails.

```bash
pnpm typecheck
```
Expected: exits 0, no new errors (the five edited files are all typed the same as before — only
`className`/`aria-*`/`id` string literals changed).

```bash
pnpm lint
```
Expected: exits 0 modulo the two pre-existing known warnings in `sign-out-button.tsx` and
`queries.ts` (per the QA doc's stated baseline) — no new warnings/errors in
`modules-editor.tsx`, `invite-code-form.tsx`, `mobile-nav.tsx`,
`learn/[courseSlug]/[lessonSlug]/page.tsx`, `login/page.tsx`, `sign-up/page.tsx`,
`admin/layout.tsx`, `catalog-filters.tsx`, `site-header.tsx`, or `site-footer.tsx`.

```bash
pnpm test
```
Expected: exits 0. None of these six components have dedicated unit tests today (grep
`modules-editor|invite-code-form|catalog-filters|site-header|site-footer` under `src/**/*.test.ts*`
to confirm before/after — if this turns up nothing, the full suite passing with no new failures is
the bar, not new test coverage, since WS3's scope is the QA doc's C1–C5 items only).

```bash
pnpm build
```
Expected: exits 0, production build succeeds (this also re-typechecks and re-lints under the hood
per `next build`'s normal behavior, though `CLAUDE.md` notes `next build` no longer lints — the
explicit `pnpm lint` above is still required).

Finally, run through all six manual verification steps above (Steps 1–5) with a real screen reader
(VoiceOver on macOS: Cmd+F5; NVDA on Windows) against `pnpm dev`, since none of this is covered by
an automated a11y harness — there isn't one in this repo, and this plan does not introduce one.

---

## Files touched (summary)

- `src/components/admin/modules-editor.tsx` (C1)
- `src/components/auth/invite-code-form.tsx` (C2)
- `src/components/layout/mobile-nav.tsx` (C3)
- `src/app/(site)/learn/[courseSlug]/[lessonSlug]/page.tsx` (C3)
- `src/app/(auth)/login/page.tsx` (C3)
- `src/app/(auth)/sign-up/page.tsx` (C3)
- `src/app/admin/layout.tsx` (C3)
- `src/components/course/catalog-filters.tsx` (C3)
- `src/components/layout/site-header.tsx` (C4)
- `src/components/layout/site-footer.tsx` (C5)
