---
title: Building a Palette
module: Systems
isPreview: false
---

## Assign roles before choosing combinations

A working palette names what each colour does. Start with page background, raised surface, primary text, secondary text, border, accent, and focus or status colours. A role-based system prevents each new page from becoming a fresh colour exercise.

The Sodales palette provides a concrete example:

```css
--color-obsidian: #111111;
--color-ivory: #f4f2ed;
--color-graphite: #35373b;
--color-violet: #5e4fb3;
--color-deep-ink: #211c35;
--color-pale-lilac: #ded9ef;
--color-paper: #fbfaf7;
```

These names are stable references, but a component should still express purpose. For example, a page could map paper to its background, obsidian to primary text, graphite to secondary text, and violet to an accent. Record that mapping so another designer does not have to infer it from screenshots.

## Check pairs, not isolated swatches

Contrast belongs to a foreground-background pair. A violet that works for a large decorative shape may not work for small text on ivory. Check each pair with a contrast tool at the intended text size and weight. Test normal, hover, focus, disabled, error, and selected states separately.

> Never use colour as the only signal. Pair a red field border with an error message, or a selected tab colour with shape, weight, or an indicator.

Also inspect the palette under common colour-vision simulations and in grayscale. The goal is not to remove colour; it is to make sure the task remains understandable when colour differences are harder to perceive.

## Build a small usage sheet

Create samples of the combinations that will ship:

- Body text and links on the main background
- Text and controls on the accent colour
- Cards against the page background
- Borders and focus indicators beside each surface
- Success, warning, and error messages with icons or labels

Write “do not” examples beside them. Pale lilac may suit a quiet surface but not small text on paper. A brand palette earns its keep when a developer can choose a tested pair from the sheet without inventing another hex value.
