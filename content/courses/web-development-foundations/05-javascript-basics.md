---
title: JavaScript Basics
module: Interactivity
isPreview: false
---

## A menu button, assembled in four passes

The HTML already contains a button and a hidden menu. JavaScript needs to connect them without replacing the useful structure that is already there.

### Pass 1: references

`const` gives each page element a stable name. `let` holds the piece of state that will change:

```js
const menuButton = document.querySelector("[data-menu-button]");
const menu = document.querySelector("[data-menu]");
let isMenuOpen = false;
```

Names such as `menuButton` and `isMenuOpen` save the reader from decoding `thing` or `data` later.

### Pass 2: one state change

A function collects the updates that belong together. It receives the desired state rather than guessing from the current CSS.

```js
function setMenuOpen(open) {
  isMenuOpen = open;
  menu.hidden = !open;
  menuButton.setAttribute("aria-expanded", String(open));
}
```

The function changes the visible menu and the button’s accessibility state in the same operation. Its parameter is local input; the two `const` references and `let` state live outside it.

### Pass 3: the event

```js
menuButton.addEventListener("click", () => {
  setMenuOpen(!isMenuOpen);
});
```

The browser fires a click event, then the handler calls the function with the opposite state. Repeated clicks now alternate between open and closed.

### Pass 4: failure checks

The interaction gets four quick checks:

- Mouse click opens and closes it more than once.
- Tab reaches the button; Enter and Space activate it.
- `aria-expanded` matches the visible state after every change.
- A reload returns to the state declared in HTML.

> Native controls carry useful keyboard behavior. A `<button>` needs less repair work than a clickable `<div>`.

## What remains without JavaScript

Turn JavaScript off and reload. The enhanced menu may stop toggling, but essential information needs another route. A restaurant can keep its address and telephone number in the page footer, and primary destinations can remain ordinary links in the HTML. The script owns the toggle; it does not own the only copy of the business details.
