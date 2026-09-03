---
title: Responsive Design
module: Styling
isPreview: false
---

## Begin with the narrow layout

Mobile-first CSS starts with the smallest practical layout, then adds changes when the content needs more room. The approach keeps the base rules compact and makes each breakpoint answer a visible problem.

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

The page has breathing room on a small screen and stops growing at a readable maximum. The hero gains columns only when 48rem gives both parts enough space.

## Let content choose breakpoints

Do not collect device names and design around them. Resize the browser slowly. Add a breakpoint where navigation wraps badly, a text line becomes tiring to read, or two columns become cramped. A new phone width should still work because the layout responds to available space rather than a model number.

Use relative units according to the job:

- `rem` ties spacing and breakpoints to the root text size.
- `%` lets an element follow its containing block.
- `vw` and `vh` follow the viewport, but need limits for readable text and usable controls.
- `fr` divides available space inside a grid.
- `ch` gives a useful measure for line length.

Fluid values can remove unnecessary breakpoints. For example, `font-size: clamp(2rem, 5vw, 4rem)` grows between a safe minimum and maximum.

## Test stress, not screenshots

Check more than three preset widths. Zoom to 200%, increase the browser’s default text size, replace a short heading with a long one, and navigate with a keyboard. Test landscape as well as portrait.

> Responsive work is complete when the content remains readable and operable across changing space, not when three screenshots match a design file.

Inspect any horizontal scrollbar immediately. Common causes include fixed widths, unbroken URLs, large images without `max-width: 100%`, and children that refuse to shrink. Fix the element causing overflow instead of hiding the page’s overflow, which can make content unreachable.
