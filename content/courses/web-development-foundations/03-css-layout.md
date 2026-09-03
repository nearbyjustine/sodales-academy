---
title: CSS Layout
module: Styling
isPreview: false
---

## Start with the box

Every element occupies a box made of content, padding, border, and margin. Width normally applies to the content alone, which can produce surprises when padding is added. Set `box-sizing` once so declared dimensions include padding and border:

```css
*, *::before, *::after {
  box-sizing: border-box;
}

.card {
  width: 20rem;
  padding: 1.25rem;
  border: 1px solid #d8d5cc;
}
```

Read the layers from the inside out:

- Content holds the text, image, or child elements.
- Padding creates space inside the border.
- Border draws the box’s edge.
- Margin separates the box from its neighbors.

Use the browser inspector’s box-model diagram when an element appears wider or farther away than expected.

## Use flexbox for a row or column

Flexbox arranges items along one main direction. It suits navigation bars, button groups, card internals, and layouts where items need to align or share spare space.

```css
.actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
}
```

Let `gap` create consistent space between children instead of placing a margin on every child. Add wrapping when content must survive narrow containers or longer translated labels.

## Use grid for rows and columns

Grid controls two dimensions at once. It works well for galleries, feature comparisons, and page regions that need aligned columns.

```css
.services {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(16rem, 100%), 1fr));
  gap: 1.5rem;
}
```

This grid creates as many usable columns as the container can hold, while letting a card occupy the full width on a small screen.

> Choose the layout from the relationship between items. A one-dimensional relationship points to flexbox; alignment across rows and columns points to grid.

Avoid absolute positioning for the main layout. It removes elements from normal flow, so later content cannot make room for them. Reserve it for overlays or small decorative pieces whose position belongs to a containing box. Build one card with normal flow first, make its content work at several lengths, and then place multiple cards with flexbox or grid.
