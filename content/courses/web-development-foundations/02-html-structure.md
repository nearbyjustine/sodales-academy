---
title: HTML Structure
module: Fundamentals
isPreview: false
---

## Give each region a job

HTML describes what content is and how it is organised. Choose elements by meaning before appearance. A page usually has a `<header>`, a `<nav>` for primary links, one `<main>` region, and a `<footer>`. Inside the main content, `<section>` groups a named topic while `<article>` holds something that can stand on its own.

```html
<header>
  <a href="/">Maya's Bakery</a>
  <nav aria-label="Primary">
    <a href="/menu">Menu</a>
    <a href="/contact">Contact</a>
  </nav>
</header>
<main>
  <h1>Fresh bread for weekday mornings</h1>
  <p>Order by 3 p.m. for collection the next day.</p>
</main>
```

This structure gives browsers, search tools, and assistive technology useful information without relying on CSS class names.

## Keep the outline understandable

Use one descriptive `<h1>` for the page’s main topic. Nest later headings in order: an `<h2>` starts a major section, and an `<h3>` belongs inside it. Do not choose a heading level because its default size looks right; change the size with CSS.

Read only the headings aloud. They should form a useful outline. “Our services,” followed by “Repairs” and “Custom builds,” explains more than “Welcome,” “Learn more,” and “Details.”

## Build accessibility into the markup

Native HTML already handles many keyboard and screen-reader behaviors. Use a `<button>` for an action and an `<a>` for navigation. Connect every form control to a visible label. Give images useful alternative text when they convey information, and use empty alternative text for decoration.

Before styling, check this list:

- Can you reach every control with the Tab key?
- Does focus move in the same order as the page reads?
- Do links make sense without nearby text?
- Does every input have a clear label and error message?
- Does the page remain understandable if images fail to load?

> A clickable `<div>` starts with none of a button’s keyboard behavior, focus handling, or role. Rebuilding those features costs more than choosing `<button>` at the start.

Save the document, open it without CSS, and scan it from top to bottom. If its hierarchy still makes sense, you have a sound base for layout and styling.
