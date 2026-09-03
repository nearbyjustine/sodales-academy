---
title: Choosing Type
module: Systems
isPreview: false
---

## Start with the reading job

Choose type by testing real material: the longest service name, a price, navigation labels, a paragraph, and an error message. A beautiful specimen word says little about how the family handles a full site or document.

Before pairing fonts, see whether one family can cover the system. A family with readable regular text, a clear bold weight, italics, and several widths often supplies enough contrast through size and weight alone. Fewer font files also mean fewer licenses to track and fewer assets to load.

```css
:root {
  --step-0: 1rem;
  --step-1: 1.25rem;
  --step-2: 1.75rem;
  --step-3: 2.5rem;
}

body { font-size: var(--step-0); line-height: 1.6; }
h3 { font-size: var(--step-1); line-height: 1.3; }
h2 { font-size: var(--step-2); line-height: 1.2; }
h1 { font-size: var(--step-3); line-height: 1.1; }
```

The exact scale can change. The useful part is a limited set of deliberate steps rather than a new size for each component.

## Pair by role

If the identity needs two typefaces, give each a clear responsibility. One might handle display headings while the other handles body text, labels, and forms. Test whether the contrast is visible without making the page feel split between two brands.

Check the details that tend to break after handoff:

- Currency symbols, punctuation, accented names, and local languages
- Numerals that remain distinct in prices, dates, and tables
- Licenses for web, print, social templates, and client-editable files
- Sensible fallback fonts for devices where the chosen face is unavailable

> Restraint makes hierarchy easier to learn. Readers should not need to decode five fonts, seven weights, and unrelated capitalization rules.

## Document hierarchy through examples

Create a sample page showing a heading, standfirst, body copy, list, quote, caption, button, and form label. Annotate size, weight, line height, spacing, and maximum line length. Then test it on a narrow screen and at increased text size.

When something feels flat, adjust spacing or weight before adding another font. Typography becomes a system when the same rules solve ordinary pages, long names, empty states, and dense forms.
