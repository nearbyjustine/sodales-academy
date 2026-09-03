---
title: Responsive Design
module: Styling
isPreview: false
---

## Before: three screenshots, three patches

The first pass targets familiar device widths. Its hero looks right in the designer’s three screenshots:

```css
.page { width: 1200px; }
.hero { display: grid; grid-template-columns: 720px 480px; }

@media (max-width: 768px) {
  .page { width: 720px; }
}

@media (max-width: 390px) {
  .page { width: 358px; }
  .hero { display: block; }
}
```

The annotations on the review copy identify four failures:

1. A `430px` phone matches none of the intended layouts and shows a horizontal scrollbar.
2. Fixed page widths leave no flexible space for browser zoom or larger default text.
3. The two hero columns total the whole page width before any gap is added.
4. The breakpoint names a screenshot width, not the point where the content becomes cramped.

## After: one flexible base

```css
.page {
  width: min(100% - 2rem, 70rem);
  margin-inline: auto;
}

.hero {
  display: grid;
  gap: 2rem;
}

@media (min-width: 48rem) {
  .hero {
    grid-template-columns: 3fr 2fr;
    align-items: center;
  }
}
```

The narrow layout is now the default. The page follows its container but stops at `70rem`; the hero gains columns when both pieces have enough room. The `fr` units divide available grid space after the gap rather than pretending the gap has no width.

> A breakpoint records where content needs a different arrangement. It does not certify a particular phone model.

## Notes from the resize pass

Dragging the viewport exposes the exact moment the navigation wraps and the hero feels crowded. That evidence sets the breakpoint. A fluid heading such as `clamp(2rem, 5vw, 4rem)` can grow between limits without another media query.

Relative units have different jobs:

- `rem` follows the root text size.
- `%` follows the containing block.
- `fr` shares free grid space.
- `ch` can cap a readable text measure.

## The 200% zoom result

At 200% zoom, the revised page returns to one column and keeps every control reachable. A long heading wraps rather than escaping its card. Large images use `max-width: 100%`. The final check keeps overflow visible during debugging, because hiding it would only conceal content that a reader still cannot reach.
