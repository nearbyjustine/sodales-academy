---
title: JavaScript Basics
module: Interactivity
isPreview: false
---

## Store values with clear names

JavaScript adds behavior to a page. A variable gives a value a name. Use `const` when the binding will not be reassigned and `let` when it will.

```js
const bookingButton = document.querySelector("[data-booking-button]");
let isMenuOpen = false;
```

The names describe what the values mean. Avoid vague containers such as `data` or `thing`, especially when several elements and states appear in the same file.

## Put repeated behavior in a function

A function accepts input, performs work, and may return output. Keep calculations separate from page updates when possible:

```js
function formatTotal(amount) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}

const totalText = document.querySelector("[data-order-total]");
totalText.textContent = formatTotal(1250);
```

You can check `formatTotal` with several numbers without clicking through the interface. The last two lines handle the Document Object Model, the browser’s object representation of the HTML page.

## Respond to an event

An event reports something that happened: a click, input change, form submission, or key press. Register a function to run when the event occurs.

```js
const menuButton = document.querySelector("[data-menu-button]");
const menu = document.querySelector("[data-menu]");

menuButton.addEventListener("click", () => {
  isMenuOpen = !isMenuOpen;
  menu.hidden = !isMenuOpen;
  menuButton.setAttribute("aria-expanded", String(isMenuOpen));
});
```

The handler updates both the visible menu and the button’s accessibility state. HTML should set the initial `hidden` and `aria-expanded="false"` values so the interface begins in a consistent state.

> JavaScript should support the page’s task. If ordinary navigation or a native form already does the job, extra event code creates more ways for it to fail.

After adding an interaction:

- Use it with a mouse and keyboard.
- Reload and confirm the initial state matches the HTML.
- Try the action several times, not only once.
- Disable JavaScript and decide what still needs to work.

A restaurant’s address and telephone number should remain readable even if an animated menu does not run.
