---
title: Building a Palette
module: Systems
isPreview: false
---

## Before: seven attractive swatches

The first palette file contains seven colours and no usage notes. A designer uses violet for a heading. A developer uses it for a button. Someone else puts pale lilac body text on paper because the combination looks quiet. Every choice comes from taste, so the same colours produce three different systems.

The source values themselves are clear:

```css
--color-obsidian: #111111;
--color-ivory: #f4f2ed;
--color-graphite: #35373b;
--color-violet: #5e4fb3;
--color-deep-ink: #211c35;
--color-pale-lilac: #ded9ef;
--color-paper: #fbfaf7;
```

## Audit notes

The problem appears when each swatch meets content. Colour contrast belongs to a foreground-background pair, at a particular text size and weight. A colour that works as a large decorative shape may fail as small text.

The audit records each real use instead of rating colours in isolation:

| Element | Foreground | Background | Check |
| --- | --- | --- | --- |
| Body copy | Obsidian | Paper | Text contrast |
| Secondary copy | Graphite | Ivory | Text contrast |
| Link | Violet | Paper | Normal, hover, focus |
| Quiet panel | Deep ink | Pale lilac | Text and icons |

Each proposed pair still needs a contrast tool check at its intended size. Grayscale and colour-vision simulations help reveal controls that depend on hue alone.

> A selected tab needs more than a new colour. Add an underline, weight change, shape, or another visible indicator.

## After: roles people can reuse

The revised file maps the palette to jobs: paper for the main background, ivory for an alternate surface, obsidian for primary text, graphite for secondary text, violet for tested accents, deep ink for dark surfaces, and pale lilac for quiet panels.

It also includes a short handoff list:

- Approved text and background pairs
- Link and button states, including keyboard focus
- Error and success labels that do not rely on colour
- Examples of pale lilac used as a surface rather than small text

The seven hex values have not changed. The after version removes guesswork by showing where each one belongs and which combinations have been checked.
