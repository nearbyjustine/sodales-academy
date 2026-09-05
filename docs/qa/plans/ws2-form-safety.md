# Workstream 2 — Form submission safety (A2, A3, E7)

Source: `docs/qa/2026-09-05-frontend-qa.md` §A2, §A3, §E7.

Scope: four implementation files, plus four new test files.

- `src/components/admin/course-form.tsx` (A2)
- `src/components/admin/track-form.tsx` (A2)
- `src/components/admin/course-row-actions.tsx` (A3)
- `src/components/admin/track-row-actions.tsx` (A3)
- `src/components/auth/google-button.tsx` (E7)
- New: `src/components/admin/course-form.test.tsx`, `src/components/admin/track-form.test.tsx`,
  `src/components/admin/course-row-actions.test.tsx`, `src/components/admin/track-row-actions.test.tsx`

Pattern to match throughout: `src/components/course/enroll-button.tsx`'s `useTransition` +
`pending` + disabled/relabelled button + `result.ok` branch + `toast.error(result.message)` on
failure. No new dependencies, no new components.

**A Client Component test harness already exists in this repo** — `@testing-library/react`,
`jsdom`, and `vitest` are wired up (`vitest.config.ts`: `environment: "jsdom"`), and two component
tests already run against it: `src/components/brand/brand-wordmark.test.tsx` and
`src/components/track/track-map.test.tsx`. The latter is the exact model to copy: it renders a
component that transitively imports a Server Action from `src/lib/content/mutations.ts` and mocks
that module narrowly with `vi.mock("@/lib/content/mutations", ...)` plus `vi.mock("next/navigation",
...)`, for the reason documented at its top (`@neondatabase/auth`'s bare `next/headers` import
can't resolve under Node's strict ESM loader outside Next's bundler — see `CLAUDE.md`). All four new
test files use that same pair of mocks.

`@testing-library/user-event` is **not installed** in this repo (`package.json` has
`@testing-library/react`/`jest-dom`/`jsdom`/`vitest` only). Every interaction below uses `fireEvent`
from `@testing-library/react`. Do not add `user-event` to make these tests nicer to write — it is
not a dependency of this project and installing it is out of scope for a QA fix.

`@testing-library/jest-dom` is also a listed dependency, but it is **not wired into
`vitest.config.ts`** (no `test.setupFiles`) and no existing test imports it. Rather than add a
`setupFiles` entry (a config change beyond this workstream's scope) or import
`@testing-library/jest-dom/vitest` per-file (a pattern with zero precedent in this repo), the new
tests assert directly on DOM properties (`(el as HTMLButtonElement).disabled`) and on
`getByRole`/`queryByRole` presence/absence, matching the plain-assertion style already used in
`track-map.test.tsx`/`brand-wordmark.test.tsx` (`toBeDefined()`/`toBeNull()`, no custom matchers).

---

## Step 1 — A2: `course-form.tsx` gets a pending state

File: `src/components/admin/course-form.tsx`

1a. Add `useTransition` to the React import (line 3):

```ts
import { useState, useTransition } from "react";
```

1b. Add the transition hook next to the existing `useState` calls (after line 64,
`const [errors, setErrors] = useState<Record<string, string>>({});`):

```ts
  const [pending, startTransition] = useTransition();
```

1c. Replace the whole `handleSubmit` function (current lines 74-104) with:

```ts
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = courseInputSchema.safeParse(state);

    if (!result.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join(".");
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);

      const firstKey = Object.keys(nextErrors)[0];
      document.getElementById(firstKey)?.focus();
      return;
    }

    setErrors({});
    startTransition(async () => {
      const mutationResult = courseId
        ? await updateCourse(courseId, result.data)
        : await createCourse(result.data);

      if (!mutationResult.ok) {
        toast.error(mutationResult.message);
        return;
      }

      toast.success(courseId ? "Course updated." : "Course created.");
      router.push("/admin/courses");
    });
  }
```

Note: `handleSubmit` drops the `async` keyword — validation and `event.preventDefault()` still run
synchronously on click; only the mutation call moves inside `startTransition`, exactly like
`enroll-button.tsx`'s `handleClick`. The existing `result.ok`/`toast.error(result.message)` branch
is preserved verbatim, just relocated.

1d. Replace the submit button (current lines 252-254):

```tsx
      <Button type="submit" className="self-start" disabled={pending}>
        {pending ? "Saving…" : "Save course"}
      </Button>
```

---

## Step 2 — A2: `track-form.tsx` gets a pending state

File: `src/components/admin/track-form.tsx`

2a. Add `useTransition` to the React import (line 3):

```ts
import { useState, useTransition } from "react";
```

2b. Add the transition hook next to the existing `useState` calls (after line 68,
`const [errors, setErrors] = useState<Record<string, string>>({});`):

```ts
  const [pending, startTransition] = useTransition();
```

2c. Replace the whole `handleSubmit` function (current lines 91-121) with:

```ts
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = trackInputSchema.safeParse(state);

    if (!result.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join(".");
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);

      const firstKey = Object.keys(nextErrors)[0];
      document.getElementById(firstKey)?.focus();
      return;
    }

    setErrors({});
    startTransition(async () => {
      const mutationResult = track
        ? await updateTrack(track.id, result.data)
        : await createTrack(result.data);

      if (!mutationResult.ok) {
        toast.error(mutationResult.message);
        return;
      }

      toast.success(track ? "Track updated." : "Track created.");
      router.push("/admin/tracks");
    });
  }
```

2d. Replace the submit button (current lines 292-294):

```tsx
      <Button type="submit" className="self-start" disabled={pending}>
        {pending ? "Saving…" : track ? "Save track" : "Create track"}
      </Button>
```

---

## Step 3 — Automated test: `CourseForm` pending state (A2)

New file: `src/components/admin/course-form.test.tsx`

This is a real regression test for the A2 defect: it mocks `updateCourse` to return a promise that
never resolves, submits the form, and asserts the submit button is disabled and relabelled. **What
would have to break for this test to fail:** removing `disabled={pending}` or the
`pending ? "Saving…" : "Save course"` label swap added in Step 1d (i.e., reintroducing the exact
A2 bug), or moving the mutation call back outside `startTransition` (so `pending` never becomes
`true`). Either regression means `getByRole("button", { name: "Saving…" })` never finds a match and
the `waitFor` times out.

To avoid needing to fill in every required field of `courseInputSchema` (title, slug, description,
category, level, one module with one lesson, instructor) via simulated typing, the test renders the
form in **edit mode** with an `initial` value that is already schema-valid — submitting fires the
mutation with zero field edits.

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { CourseInput } from "@/lib/validation";

// `CourseForm` imports `createCourse`/`updateCourse` from `@/lib/content/mutations`, which
// transitively pulls in `@neondatabase/auth`'s bare `next/headers` import — Node's strict ESM
// loader can't resolve that outside Next's own bundler (see CLAUDE.md and
// `src/components/track/track-map.test.tsx`, which documents/works around the same problem).
// `mockUpdateCourse` never resolves, so `pending` has no way to flip back to `false` mid-test.
const mockUpdateCourse = vi.fn(() => new Promise(() => {}));
const mockCreateCourse = vi.fn();
vi.mock("@/lib/content/mutations", () => ({
  createCourse: (...args: unknown[]) => mockCreateCourse(...args),
  updateCourse: (...args: unknown[]) => mockUpdateCourse(...args),
}));

// `CourseForm` also calls `useRouter()` for the post-save `router.push`, which throws outside a
// real Next.js app-router tree (same reason `track-map.test.tsx` stubs it). Nothing here reaches
// the push, since `updateCourse` never resolves, but the hook still has to exist.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { CourseForm } = await import("./course-form");

// Already valid per `courseInputSchema` (see src/lib/validation.ts) — submitting this with no
// field edits exercises the pending state without simulating typing into every required input,
// including the nested `ModulesEditor` fields.
const validCourse: CourseInput = {
  title: "QA Regression Course",
  slug: "qa-regression-course",
  description: "A course fixture used only to exercise the pending-state regression test.",
  category: "Design",
  level: "beginner",
  modules: [
    {
      title: "Module One",
      position: 1,
      lessons: [
        {
          title: "Lesson One",
          slug: "lesson-one",
          position: 1,
          isPreview: false,
          content: "x".repeat(60),
        },
      ],
    },
  ],
  instructorUserId: "11111111-1111-1111-1111-111111111111",
};

describe("CourseForm", () => {
  afterEach(() => {
    mockUpdateCourse.mockClear();
  });

  it("disables and relabels the submit button while updateCourse is in flight", async () => {
    render(
      <CourseForm
        initial={validCourse}
        heading="Edit course"
        courseId="course-1"
        viewerRole="admin"
        instructors={[{ userId: validCourse.instructorUserId, name: "Instructor One" }]}
      />,
    );

    const submit = screen.getByRole("button", { name: "Save course" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);

    fireEvent.submit(submit.closest("form")!);

    await waitFor(() => {
      const pendingButton = screen.getByRole("button", { name: "Saving…" }) as HTMLButtonElement;
      expect(pendingButton.disabled).toBe(true);
    });

    // A second submit while pending must not fire a second mutation call — this is the literal
    // "second click fires a second create" failure mode from A2.
    fireEvent.submit(submit.closest("form")!);
    expect(mockUpdateCourse).toHaveBeenCalledTimes(1);
  });
});
```

Why `fireEvent.submit(form)` rather than `fireEvent.click(submitButton)`: it invokes the React
`onSubmit` handler directly and deterministically, without depending on jsdom's native
button-click-triggers-form-submission wiring. This is a plain, dependency-free `<form>` (no
Base UI involved), so there is no interaction-model uncertainty here — unlike the row-actions
tests in Step 7/8.

---

## Step 4 — Automated test: `TrackForm` pending state (A2)

New file: `src/components/admin/track-form.test.tsx`

Same shape as Step 3, applied to `createTrack`/`updateTrack`. `TrackDetail`'s `courses: []` and
`trackInputSchema`'s `courseIds: z.array(z.string().uuid())` (no minimum) mean an empty course list
is schema-valid, so this needs no `courses` fixture data at all.

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { TrackDetail } from "@/lib/content/types";

// Same `next/headers`-under-Vitest problem as course-form.test.tsx; same mock shape.
const mockUpdateTrack = vi.fn(() => new Promise(() => {}));
const mockCreateTrack = vi.fn();
vi.mock("@/lib/content/mutations", () => ({
  createTrack: (...args: unknown[]) => mockCreateTrack(...args),
  updateTrack: (...args: unknown[]) => mockUpdateTrack(...args),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { TrackForm } = await import("./track-form");

// Already valid per `trackInputSchema` (see src/lib/validation.ts).
const validTrack: TrackDetail = {
  id: "track-1",
  slug: "qa-regression-track",
  title: "QA Regression Track",
  promise: "Ship one thing.",
  outcome: "You finish able to ship one thing end to end.",
  status: "draft",
  position: 0,
  courseCount: 0,
  lessonCount: 0,
  courses: [],
};

describe("TrackForm", () => {
  afterEach(() => {
    mockUpdateTrack.mockClear();
  });

  it("disables and relabels the submit button while updateTrack is in flight", async () => {
    render(<TrackForm track={validTrack} courses={[]} />);

    const submit = screen.getByRole("button", { name: "Save track" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);

    fireEvent.submit(submit.closest("form")!);

    await waitFor(() => {
      const pendingButton = screen.getByRole("button", { name: "Saving…" }) as HTMLButtonElement;
      expect(pendingButton.disabled).toBe(true);
    });

    fireEvent.submit(submit.closest("form")!);
    expect(mockUpdateTrack).toHaveBeenCalledTimes(1);
  });
});
```

**What would have to break for Steps 3/4 to fail:** either test fails if Step 1d/2d's
disabled+relabel is missing or reverted, if the mutation call is pulled back out of
`startTransition`, or if a future edit lets a second submit through while pending (the
`toHaveBeenCalledTimes(1)` assertion after the second `fireEvent.submit`).

---

## Step 5 — A3: `course-row-actions.tsx` — dialog stays open until the result is known

File: `src/components/admin/course-row-actions.tsx`

Design: control the outer `<Dialog>`'s `open` state instead of letting `DialogClose` on the
Delete button close it synchronously. Delete goes through `useTransition` so the confirm button
can be disabled/relabelled while in flight. `onOpenChange` refuses to close the dialog (ignores
the `false` transition) while a delete is pending — this blocks Cancel-click, the built-in `X`
close button inside `DialogContent`, backdrop click, and Escape, all of which route through
`DialogPrimitive.Root`'s `onOpenChange` per `src/components/ui/dialog.tsx:10-24`. On success the
handler calls `setDeleteOpen(false)` itself; on failure it leaves `deleteOpen` as-is (still
`true`) and lets the existing `toast.error` surface the reason, so the dialog and the still-listed
row stay visible and consistent with each other — no more "dialog vanishes, toast contradicts it."

5a. Update imports — add `useState`, `useTransition` from `"react"` (there is currently no React
import in this file at all; add it as a new top import before `"next/link"`):

```ts
import { useState, useTransition } from "react";
```

5b. Replace `handleDelete` and add the two new state hooks. Current (lines 40-65):

```ts
  const router = useRouter();

  async function handleTogglePublish() {
    ...
  }

  async function handleDelete() {
    const result = await deleteCourse(id);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Course deleted.");
    router.refresh();
  }
```

New:

```ts
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, startDeleteTransition] = useTransition();

  async function handleTogglePublish() {
    const result =
      status === "published" ? await unpublishCourse(id) : await publishCourse(id);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(status === "published" ? "Course unpublished." : "Course published.");
    router.refresh();
  }

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deleteCourse(id);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Course deleted.");
      setDeleteOpen(false);
      router.refresh();
    });
  }

  function handleDeleteDialogOpenChange(open: boolean) {
    if (deletePending && !open) return;
    setDeleteOpen(open);
  }
```

(`handleTogglePublish` is reproduced unchanged — only its position moved below the new state
hooks — so the diff is easy to review: no behavior change to publish/unpublish, which is out of
scope for A3.)

5c. Wire the controlled state onto `<Dialog>` and split the Delete button off `DialogClose`.
Current (lines 67-99):

```tsx
    <Dialog>
      <DropdownMenu>
        ...
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href={`/admin/courses/${courseId}/edit`} />}>
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleTogglePublish}>
            {status === "published" ? "Unpublish" : "Publish"}
          </DropdownMenuItem>
          <DialogTrigger render={<DropdownMenuItem variant="destructive" />}>Delete</DialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{courseTitle}&rdquo;?</DialogTitle>
          <DialogDescription>This action cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <DialogClose render={<Button variant="destructive" onClick={handleDelete} />}>
            Delete
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
```

New:

```tsx
    <Dialog open={deleteOpen} onOpenChange={handleDeleteDialogOpenChange}>
      <DropdownMenu>
        ...
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href={`/admin/courses/${courseId}/edit`} />}>
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleTogglePublish}>
            {status === "published" ? "Unpublish" : "Publish"}
          </DropdownMenuItem>
          <DialogTrigger render={<DropdownMenuItem variant="destructive" />}>Delete</DialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{courseTitle}&rdquo;?</DialogTitle>
          <DialogDescription>This action cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={deletePending} />}>
            Cancel
          </DialogClose>
          <Button variant="destructive" disabled={deletePending} onClick={handleDelete}>
            {deletePending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
```

(`...` marks the unchanged `DropdownMenuTrigger` block, lines 70-74 — leave it exactly as-is.)

The Delete button is no longer a `DialogClose` at all: it is a plain `Button` whose only job is to
call `handleDelete`, so nothing closes the dialog synchronously on click. `Cancel` stays a
`DialogClose` (still fires `onOpenChange(false)` under the hood, which `handleDeleteDialogOpenChange`
honors as long as `deletePending` is false) and is disabled while a delete is in flight.

---

## Step 6 — A3: `track-row-actions.tsx` — identical fix

File: `src/components/admin/track-row-actions.tsx`

Same shape as Step 5, applied to `deleteTrack`/`trackTitle`.

6a. Add the import:

```ts
import { useState, useTransition } from "react";
```

6b. Replace `handleDelete` and add state (current lines 36-60, same structure as course's
pre-Step-5 code but with `deleteTrack`/`"Track deleted."`):

```ts
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, startDeleteTransition] = useTransition();

  async function handleTogglePublish() {
    const result = status === "published" ? await unpublishTrack(id) : await publishTrack(id);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(status === "published" ? "Track unpublished." : "Track published.");
    router.refresh();
  }

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deleteTrack(id);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Track deleted.");
      setDeleteOpen(false);
      router.refresh();
    });
  }

  function handleDeleteDialogOpenChange(open: boolean) {
    if (deletePending && !open) return;
    setDeleteOpen(open);
  }
```

6c. Wire the dialog (current lines 62-97), same transformation as Step 5c — note the track dialog
has a longer `DialogDescription` (cascade note) that must be preserved verbatim:

```tsx
    <Dialog open={deleteOpen} onOpenChange={handleDeleteDialogOpenChange}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${trackTitle}`} />}
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href={`/admin/tracks/${id}/edit`} />}>
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleTogglePublish}>
            {status === "published" ? "Unpublish" : "Publish"}
          </DropdownMenuItem>
          <DialogTrigger render={<DropdownMenuItem variant="destructive" />}>Delete</DialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{trackTitle}&rdquo;?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. Enrolled learners keep their course progress — deleting a
            track only removes the ordered path, not any course or enrollment it links to.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={deletePending} />}>
            Cancel
          </DialogClose>
          <Button variant="destructive" disabled={deletePending} onClick={handleDelete}>
            {deletePending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
```

---

## Step 7 — Automated tests: `CourseRowActions` delete dialog (A3)

New file: `src/components/admin/course-row-actions.test.tsx`

**This is the single most valuable test in the workstream** — it exercises the actual defect
(dialog closing before the result is known) end to end: open the row's actions menu, click
"Delete", click the confirm button, and assert what the dialog does in the DOM.

### Interaction-model research (why these specific events)

Base UI's `<Menu.Trigger>` — what `DropdownMenuTrigger` wraps — opens on **`mousedown`**, not
`click`, when the menu is not inside a menubar:
`node_modules/@base-ui/react/menu/trigger/MenuTrigger.js:161-166`:

```js
const click = useClick(floatingRootContext, {
  enabled: !disabled,
  event: isOpenedByThisTrigger && isInMenubar ? 'click' : 'mousedown',
  toggle: true,
  ...
});
```

So the trigger must be driven with `fireEvent.mouseDown`, not `fireEvent.click` — a plain click
event never reaches the handler that opens the menu. Once open, individual `<Menu.Item>`s (role
`"menuitem"`, confirmed at `node_modules/@base-ui/react/menu/item/useMenuItemCommonProps.js:38`)
respond to a plain `onClick` handler that just emits a menu-close event
(`useMenuItemCommonProps.js:57-62`) — no pointer-type gating — so `fireEvent.click` is correct for
selecting the "Delete" item. The "Delete" item is rendered as
`<DialogTrigger render={<DropdownMenuItem variant="destructive" />}>Delete</DialogTrigger>`
(`course-row-actions.tsx`), so this same click both closes the dropdown and opens the confirmation
dialog through Base UI's render-prop merging (`DialogTrigger`'s open-on-click handler and
`DropdownMenuItem`'s own `onClick` both run).

Base UI's `Escape`-to-dismiss listener for the dialog is attached to `document` (via `useDismiss`,
`node_modules/@base-ui/react/floating-ui-react/hooks/useDismiss.js:419`, `addEventListener(doc,
'keydown', closeOnEscapeKeyDown)`), so `fireEvent.keyDown(document, { key: "Escape" })` reaches it
regardless of which element has focus.

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";

// Same `next/headers`-under-Vitest problem as the form tests; same mock shape as
// `track-map.test.tsx`. `publishCourse`/`unpublishCourse` are stubbed but unused by these tests —
// A3 only touches the delete flow.
const mockDeleteCourse = vi.fn();
vi.mock("@/lib/content/mutations", () => ({
  deleteCourse: (...args: unknown[]) => mockDeleteCourse(...args),
  publishCourse: vi.fn(),
  unpublishCourse: vi.fn(),
}));
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mockRefresh }) }));

const { CourseRowActions } = await import("./course-row-actions");

// Base UI's Menu.Trigger opens on `mousedown`, not `click` — see the Step 7 writeup in
// docs/qa/plans/ws2-form-safety.md for the exact source lines. `@testing-library/user-event` is
// not installed in this repo, so this drives the trigger with `fireEvent.mouseDown` directly.
function openDeleteConfirmation(courseTitle: string) {
  fireEvent.mouseDown(screen.getByRole("button", { name: `Actions for ${courseTitle}` }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
}

describe("CourseRowActions — delete dialog", () => {
  afterEach(() => {
    mockDeleteCourse.mockReset();
    mockRefresh.mockReset();
  });

  it("stays open with the reason surfaced when the delete fails", async () => {
    mockDeleteCourse.mockResolvedValue({ ok: false, message: "Course has active enrollments." });

    render(
      <CourseRowActions id="course-1" courseId="course-slug" courseTitle="QA Course" status="draft" />,
    );

    openDeleteConfirmation("QA Course");
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDefined();

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(mockDeleteCourse).toHaveBeenCalledWith("course-1"));

    // The defect this test targets: on failure, the dialog used to vanish (DialogClose fired
    // synchronously) while an error toast fired and the undeleted row stayed in the table. If
    // Step 5's fix regresses back to a `DialogClose`-wrapped Delete button, this dialog is gone
    // by now and `getByRole("dialog")` throws.
    const stillOpenDialog = screen.getByRole("dialog");
    expect(within(stillOpenDialog).getByRole("button", { name: "Cancel" })).toBeDefined();
    const confirmButton = within(stillOpenDialog).getByRole("button", {
      name: "Delete",
    }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(false);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("closes and refreshes the list when the delete succeeds", async () => {
    mockDeleteCourse.mockResolvedValue({ ok: true });

    render(
      <CourseRowActions
        id="course-2"
        courseId="course-slug-2"
        courseTitle="QA Course Two"
        status="draft"
      />,
    );

    openDeleteConfirmation("QA Course Two");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ignores Escape and Cancel while a delete is in flight", async () => {
    mockDeleteCourse.mockImplementation(() => new Promise(() => {})); // never resolves

    render(
      <CourseRowActions
        id="course-3"
        courseId="course-slug-3"
        courseTitle="QA Course Three"
        status="draft"
      />,
    );

    openDeleteConfirmation("QA Course Three");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      const pendingButton = within(screen.getByRole("dialog")).getByRole("button", {
        name: "Deleting…",
      }) as HTMLButtonElement;
      expect(pendingButton.disabled).toBe(true);
    });

    // Both dismissal attempts must be no-ops while `deletePending` is true — this is
    // `handleDeleteDialogOpenChange`'s guard under direct test.
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Deleting…" })).toBeDefined();
  });
});
```

**What would have to break for each assertion to fail:**
- Test 1 (`stays open ... when the delete fails`): reverting the confirm button to a `DialogClose`
  (the original A3 bug) closes the dialog synchronously on click, before `deleteCourse`'s rejection
  is even known — `screen.getByRole("dialog")` throws on the post-click lookup.
- Test 2 (`closes ... when the delete succeeds`): if `setDeleteOpen(false)` is removed from the
  success branch (e.g., "fixed" by never closing at all), `queryByRole("dialog")` stays non-null
  and the assertion fails; if `router.refresh()` is dropped, the `mockRefresh` assertion fails.
- Test 3 (`ignores Escape and Cancel ...`): if `handleDeleteDialogOpenChange` is simplified back to
  unconditional `setDeleteOpen(open)` (dropping the `deletePending` guard), either the Escape
  `keydown` or the Cancel click removes the dialog from the document, and the final
  `getByRole("dialog")` throws.

If the `mousedown`-to-open interaction turns out not to reach the handler exactly as researched
above when this is actually run (Base UI internals can change between minor versions — the
installed version is `@base-ui/react@1.7.0`, confirm with
`grep '"@base-ui/react"' package.json`), the fallback is `fireEvent.pointerDown` on the same
target before `fireEvent.mouseDown`, or `fireEvent.click` after both — try `mousedown` alone
first, since it is what the currently-installed source actually checks for.

---

## Step 8 — Automated tests: `TrackRowActions` delete dialog (A3)

New file: `src/components/admin/track-row-actions.test.tsx`

Identical to Step 7, adapted for `deleteTrack`/`publishTrack`/`unpublishTrack`/`trackTitle`/`id`
(there is no separate `courseId` prop on this component — `TrackRowActions` only takes `id`,
`trackTitle`, `status`).

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";

const mockDeleteTrack = vi.fn();
vi.mock("@/lib/content/mutations", () => ({
  deleteTrack: (...args: unknown[]) => mockDeleteTrack(...args),
  publishTrack: vi.fn(),
  unpublishTrack: vi.fn(),
}));
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mockRefresh }) }));

const { TrackRowActions } = await import("./track-row-actions");

function openDeleteConfirmation(trackTitle: string) {
  fireEvent.mouseDown(screen.getByRole("button", { name: `Actions for ${trackTitle}` }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
}

describe("TrackRowActions — delete dialog", () => {
  afterEach(() => {
    mockDeleteTrack.mockReset();
    mockRefresh.mockReset();
  });

  it("stays open with the reason surfaced when the delete fails", async () => {
    mockDeleteTrack.mockResolvedValue({ ok: false, message: "Track has enrolled learners." });

    render(<TrackRowActions id="track-1" trackTitle="QA Track" status="draft" />);

    openDeleteConfirmation("QA Track");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(mockDeleteTrack).toHaveBeenCalledWith("track-1"));

    const stillOpenDialog = screen.getByRole("dialog");
    const confirmButton = within(stillOpenDialog).getByRole("button", {
      name: "Delete",
    }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(false);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("closes and refreshes the list when the delete succeeds", async () => {
    mockDeleteTrack.mockResolvedValue({ ok: true });

    render(<TrackRowActions id="track-2" trackTitle="QA Track Two" status="draft" />);

    openDeleteConfirmation("QA Track Two");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ignores Escape and Cancel while a delete is in flight", async () => {
    mockDeleteTrack.mockImplementation(() => new Promise(() => {}));

    render(<TrackRowActions id="track-3" trackTitle="QA Track Three" status="draft" />);

    openDeleteConfirmation("QA Track Three");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      const pendingButton = within(screen.getByRole("dialog")).getByRole("button", {
        name: "Deleting…",
      }) as HTMLButtonElement;
      expect(pendingButton.disabled).toBe(true);
    });

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));

    expect(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Deleting…" }),
    ).toBeDefined();
  });
});
```

---

## Step 9 — E7: `google-button.tsx` gets a pending state

File: `src/components/auth/google-button.tsx`

9a. Add the import (line 1-3 area):

```ts
"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
```

9b. Replace `handleClick` and the returned `<Button>` (current lines 35-45):

```ts
export function GoogleButton({
  disabled = false,
  callbackURL = "/dashboard",
}: {
  disabled?: boolean;
  callbackURL?: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const { authClient } = await import("@/lib/auth/client");
      await authClient.signIn.social({ provider: "google", callbackURL });
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={disabled || pending}
      onClick={handleClick}
    >
      <GoogleGlyph />
      {pending ? "Redirecting…" : "Continue with Google"}
    </Button>
  );
}
```

Note: `authClient.signIn.social(...)` kicks off a real navigation to Google's OAuth consent
screen, so `pending` is not expected to ever flip back to `false` in the success path — that is
fine and matches the goal (block a second click for the whole window the button is on-screen).
This function does not return a `MutationResult` and is not from `src/lib/content/mutations.ts`,
so there is no `result.ok` to branch on here — E7 is pending-state only, no new error handling is
in scope. No automated test is added for this one (see "Coverage not automated" below).

---

## Step 10 — Verification

Run in order, from the repo root (`/Users/justine/Documents/sodales`):

```bash
pnpm typecheck
```
Expected: exits 0, no new errors, including in the four new `*.test.tsx` files.

```bash
pnpm lint
```
Expected: exits 0 with exactly the 2 pre-existing warnings already known in this repo (per the
task constraints) — no new warnings/errors attributable to any of the nine files touched/added.

```bash
pnpm test
```
Expected: all suites pass, including 2 new tests in `course-form.test.tsx`, 1 in
`track-form.test.tsx`, and 3 each in `course-row-actions.test.tsx`/`track-row-actions.test.tsx` —
10 new passing tests total, 0 regressions in existing suites. None of `mutations.ts`/`queries.ts`/
`authz.ts` were touched, so no existing integration test's fixtures or assertions are affected.

```bash
pnpm build
```
Expected: production build succeeds — the strongest whole-app correctness check, covering the
Client Component wiring the unit tests don't reach (real Next.js router context, real Base UI
positioning against a real browser layout, real CSS).

---

## Step 11 — Manual verification (click-by-click)

The automated tests in Steps 3/4/7/8 cover the pending-state and dialog-lifecycle logic in
isolation (mocked mutations, jsdom). They do not cover: real network latency, real Base UI
animation/positioning in a real browser, the actual toast UI, or E7 (no automated test — see
below). Run this pass against `pnpm dev`, signed in as the seeded admin (`ADMIN_EMAIL`).

**11a. A2 — course form double-submit guard**

1. Start `pnpm dev`, sign in as admin, navigate to `/admin/courses/new`.
2. Fill in Title (e.g. "QA Test Course"), Description, leave Category/Level at defaults, add one
   module with one lesson (Title + Slug filled).
3. Click "Save course" once, then immediately click it again 2 more times as fast as possible.
4. Expected: button text changes to "Saving…" and the button becomes visibly disabled
   (dimmed, per the `disabled:opacity-50` Tailwind class already on `Button`) after the first
   click — the second and third clicks do nothing (no additional network request, no duplicate
   course). On success, you land on `/admin/courses` and a single new row exists for the course
   just created. Repeat the same 3-rapid-click check on `/admin/courses/[id]/edit` for an existing
   course to confirm the update path also disables.

**11b. A2 — track form double-submit guard**

1. Navigate to `/admin/tracks/new`.
2. Fill in Title, Promise, Outcome, Position; leave courses unselected (or select one, either is
   valid for this check).
3. Click "Create track" once, then click it 2 more times immediately.
4. Expected: button reads "Saving…" and is disabled after the first click; only one track is
   created. Repeat on `/admin/tracks/[id]/edit` to confirm "Save track" also disables and shows
   "Saving…".

**11c. A3 — delete dialog stays open on failure**

Failure is easiest to force by deleting the same row twice from two tabs:

1. Open `/admin/courses` in two browser tabs, both showing the same course row.
2. In Tab A, open the row's actions menu, click "Delete", confirm the dialog appears with
   "Delete "<title>"?" and a "Delete" button.
3. In Tab B, open the same row's actions menu and click "Delete" → "Delete" to actually delete the
   course (dialog closes, toast "Course deleted.", row disappears from Tab B's table).
4. Back in Tab A, click the dialog's "Delete" button (the course no longer exists server-side, so
   `deleteCourse` should fail — confirm the exact failure message via
   `grep -n "not found\|already" src/lib/content/mutations.ts` beforehand so you know what to
   expect in the toast).
5. Expected: the "Delete" button becomes disabled and shows "Deleting…" briefly, then an error
   toast appears with the failure message AND the dialog is still open, showing the same
   "Delete "<title>"?" text — it must not have vanished. Click "Cancel" to close it, then click it
   again to confirm the dialog can still be dismissed normally afterward (the `deletePending`
   guard only blocks closing while a delete is actually in flight, not permanently).
6. Repeat steps 1-5 on `/admin/tracks` for `TrackRowActions`.

**11d. A3 — delete dialog still closes normally on success**

1. On `/admin/courses`, create a disposable course via `/admin/courses/new` (any valid input).
2. Open its row actions, click "Delete", confirm the dialog, click "Delete" once.
3. Expected: "Delete" briefly reads "Deleting…" and is disabled, then the dialog closes on its
   own, a "Course deleted." toast appears, and the row is gone from the table — no manual "Cancel"
   needed. Repeat for a disposable track on `/admin/tracks`.

**11e. E7 — Google button pending state**

1. Sign out, go to `/login`.
2. Open DevTools → Network tab, throttle to "Slow 3G" (so the pending state is visible instead of
   instantaneous).
3. Click "Continue with Google" once, then click it again immediately before the redirect fires.
4. Expected: after the first click the button reads "Redirecting…" and is disabled
   (`disabled:opacity-50`/`disabled:pointer-events-none`), so the second click is a no-op — only
   one `authClient.signIn.social` call fires (confirm in the Network tab: one navigation/request
   to the Google OAuth kickoff, not two).

---

## Coverage not automated, and why

- **E7 (`GoogleButton`)** has no automated test. `handleClick` dynamically `import()`s
  `@/lib/auth/client` and calls `authClient.signIn.social(...)`, which in the real app triggers a
  full-page navigation to Google's OAuth consent screen — there is no `MutationResult` and no
  meaningful "did it work" assertion to make in jsdom beyond "the button became disabled," which
  is already the same assertion shape as the `CourseForm`/`TrackForm` tests. Given the dynamic
  `import()` plus the extra module-resolution mocking it would need
  (`vi.mock("@/lib/auth/client", ...)`) for a single boolean check with no branching logic to
  protect, this is judged not worth the added mock surface — Step 11e's manual check is the
  verification for E7.
- **Real Base UI positioning/animation** (the actual dropdown appearing under the cursor, the
  dialog's fade/zoom transition) is not exercised by jsdom — Steps 7/8's tests confirm the state
  machine (open/closed, pending/not-pending) is correct, not that it looks right. Step 11's manual
  pass is what covers visual correctness.

## Notes / risks

- Step 5/6's `handleDeleteDialogOpenChange` intentionally allows `onOpenChange(true)`
  unconditionally (opening is never blocked) and only refuses `onOpenChange(false)` while
  `deletePending` is true. `deletePending` is guaranteed false whenever the dialog is reopened for
  a fresh delete attempt, because `useTransition`'s pending flag resets once the transition's
  callback returns (success or failure) — there is no path where a stale `true` blocks a later
  legitimate close. Step 7/8's third test asserts this guard directly.
- The Step 7/8 tests depend on the exact interaction model of `@base-ui/react@1.7.0` (confirmed by
  reading `node_modules/@base-ui/react/menu/trigger/MenuTrigger.js` and
  `.../menu/item/useMenuItemCommonProps.js` directly, not assumed) — a future `@base-ui/react`
  upgrade that changes the trigger's open-event from `mousedown` could require updating
  `openDeleteConfirmation()`'s first `fireEvent` call in both test files. This is a normal
  dependency-upgrade cost, not a design flaw — there is no `user-event`-based abstraction available
  in this repo to insulate against it.
- `publishCourse`/`unpublishCourse`/`publishTrack`/`unpublishTrack` are untouched by this
  workstream — they already return `MutationResult` and already branch on `result.ok`/
  `toast.error`; A2/A3/E7 do not ask for a pending state on those actions and adding one would
  expand scope beyond what QA flagged.
- No changes to `src/lib/content/mutations.ts`, `authz.ts`, or any schema/migration — this
  workstream is Client Component state management (plus tests for it) only, so the "never wrap in
  a transaction"/"reconcile by identity" rules in `CLAUDE.md` are not implicated.
