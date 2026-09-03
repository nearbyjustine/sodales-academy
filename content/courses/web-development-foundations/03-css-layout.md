---
title: CSS Layout
module: Styling
isPreview: false
---

## 9:10 a.m.: the bug report

“The service cards fit in the design, but the third one drops off the page.” The layout uses three `20rem` cards inside a `60rem` container. It sounds exact until the browser inspector shows what each card occupies.

```css
.card {
  width: 20rem;
  padding: 1.25rem;
  border: 1px solid #d8d5cc;
}
```

With the default content-box model, the declared width excludes padding and border. Each box is wider than `20rem`, so three cannot fit. The first repair makes dimensions include those layers:

```css
*, *::before, *::after { box-sizing: border-box; }
```

The box-model panel now accounts for content, padding, border, and margin without mental arithmetic. The cards fit at this width, but they still overflow when the browser narrows.

## 9:32 a.m.: the absolute-positioning trap

The stylesheet tries to protect the row with `position: absolute` and three left offsets. That freezes the cards in coordinates and removes them from normal flow. A longer service description runs underneath the next section because the parent no longer grows with its children.

The debugger writes down the relationship instead:

- The cards form rows and columns.
- Every card needs a usable minimum width.
- New rows should appear when space runs out.
- The space between cards should stay consistent.

Grid matches all four facts. Absolute positioning matches none of them.

## 9:48 a.m.: grid takes over

```css
.services {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(16rem, 100%), 1fr));
  gap: 1.5rem;
}
```

At wide sizes, the browser creates several aligned columns. At narrow sizes, `min(16rem, 100%)` lets a card use the available width instead of forcing overflow.

> Grid handles this two-dimensional card arrangement. Flexbox remains the better fit inside each card, where the buttons form one row or column.

## 10:05 a.m.: the retest

The third card now stays in flow, a long heading makes its row taller without overlap, and the buttons wrap inside the card. The final inspector check finds no fixed offsets and no horizontal scrollbar at the problem width. The bug log records two causes, not one: content-box dimensions made the original row too wide, and absolute positioning prevented the layout from adapting.
