# Sodales — Brand Guidelines

> Source: Sodales brand deck (Canva), pages 04–05, plus logo assets in `../../assets/`.
> Status: transcribed from the approved deck. This document is the source of truth for
> color and typography across all six Sodales apps. App-specific extensions are listed in §7.
> Referenced by `docs/sdd/00-platform.md` §8 and every app SDD's brand section.

---

## 1. Brand positioning

**Tagline:** Creative Intelligence. Collective Impact.

**Descriptor:** SODALES is a modern creative intelligence collective where strategy,
design & technology converge.

Use the tagline as a display line (Bold 36pt equivalent). Use the descriptor as body
copy for about sections, meta descriptions, and footer blurbs. Do not paraphrase either
in product copy — they are fixed strings.

---

## 2. Colour palette

| Token | Name | Hex | Role |
| ----- | ---- | --- | ---- |
| `--color-obsidian` | Obsidian Black | `#111111` | Foundation. Primary text, dark surfaces. |
| `--color-ivory` | Soft Ivory | `#F4F2ED` | Foundation. Primary light surface / page background. |
| `--color-graphite` | Graphite Gray | `#35373B` | Support. Secondary text, UI elements, borders. |
| `--color-violet` | Electric Violet | `#5E4FB3` | Accent. Used **sparingly**. |

### Usage rule (verbatim from the deck)

> Use Obsidian Black and Soft Ivory as the foundation of all compositions. Graphite
> supports secondary text and UI elements. Electric Violet is used sparingly for
> emphasis, motion, links, digital accents and sub-brand signals.

**Practical reading for the web apps:**

- Obsidian + Ivory carry the page. Every screen should read as black-on-ivory or
  ivory-on-black before any accent is applied.
- Graphite is for anything secondary: helper text, table headings, rules, disabled
  states, borders, muted metadata.
- Electric Violet is the **only** primary-action colour. Buttons, links, focus rings,
  active nav, progress fill, motion accents, and sub-brand signals. Nothing else.
- Violet is never a background for large areas in product UI. Large violet fields are
  a deck/marketing device (see the Typography page), not a product surface.

### Contrast notes

- Electric Violet `#5E4FB3` on Soft Ivory `#F4F2ED` — passes AA for body text and links.
- Soft Ivory on Electric Violet — passes AA for filled buttons.
- Graphite `#35373B` on Soft Ivory — passes AA. Do not lighten Graphite for "subtle"
  text; use size and weight instead.
- Never place Electric Violet directly on Obsidian Black for text. Insufficient contrast.

---

## 3. Typography

### Display / primary typeface

**Inter** (web) / **Neue Haas Grotesk** (print, licensed).

Inter is the web implementation. Neue Haas Grotesk is the print/deck equivalent and is
not loaded in the apps.

Deck scale:

| Role | Weight / size |
| ---- | ------------- |
| Display | Bold 80pt |
| Heading | Bold 36pt |
| Body | Regular 16pt |
| UI / Label | UPPERCASE 12pt, wide tracking |

### Alternative typeface

**Akzidenz-Grotesk** — Regular | Bold. Permitted substitute where Inter/Neue Haas is
unavailable or where a slightly warmer grotesque is wanted for editorial work. Not
loaded in the web apps by default.

### Web implementation

- Load **Inter** via `next/font/google`. It covers display, headings, body, and UI.
- UI labels, form labels, table headings, nav, and section eyebrows: uppercase,
  ~11–12px, wide letter-spacing (approx. `0.08em`–`0.12em`).
- Body copy at 16px baseline. Do not go below 14px for reading text.
- Weights in use: 400 (body), 700 (display/headings). Avoid weight soup — two weights
  carry the whole system.

---

## 4. Logo

Assets live in `../../assets/`:

| File | Variant |
| ---- | ------- |
| `1.png` | Icon mark, Electric Violet (light weight) |
| `2.png` | Horizontal lockup — icon + wordmark |
| `3.png` | Icon mark, Electric Violet (solid) |
| `4.png` | Wordmark only, gray |

### The mark

An isometric hexagonal form built from two interlocking chevron/arrow shapes rotating
around a shared centre. Reads as an abstract **S** and as motion/exchange. Angular
throughout — no curves, no outline, single flat colour in Electric Violet `#5E4FB3`.

### The wordmark

`S O D A L E S` set in a thin geometric sans with wide tracking (approx. `0.3em`), with
custom letterform cuts that are part of the identity:

- **O** — flat angled cut at the lower-left, echoing the mark's chevrons
- **D** — angled notch in the top-left of the bowl
- **A** — no crossbar
- **E** — detached top bar floating above the stem

**The wordmark must ship as SVG artwork, never as live text.** Setting `SODALES` in Inter
loses every one of the cuts above and is off-brand.

### Product lockups

Sub-brands use a text lockup of the form `SODALES | ACADEMY` (also `| PERSONA`,
`| CINEMA`, `| TALENTS`, `| STORE`). Implemented as the shared `BrandWordmark`
component in `packages/ui`. The parent wordmark keeps its artwork; the product name is
set in Inter uppercase with wide tracking, separated by a thin vertical rule in Graphite.

### Clear space and minimum size

- Clear space on all sides: at least the height of the mark's central chevron
  (approximately 25% of the mark's total height).
- Minimum size: 24px height for the icon mark; 120px width for the horizontal lockup.
- Below that, use the icon mark alone.

### Reversed variant

**Missing from current assets.** Dark surfaces (Cinema throughout, Academy lesson chrome,
admin dark states) need an Ivory `#F4F2ED` version of the wordmark and a light version of
the mark. Request from Rak A. [B2] before building dark headers.

### Don'ts

- Do not recolour the mark outside Electric Violet, Obsidian, or Ivory.
- Do not add effects — no gradients, shadows, glows, outlines, or strokes.
- Do not rotate, skew, stretch, or condense.
- Do not rebuild the wordmark as live text.
- Do not place the violet mark on Obsidian Black — use the Ivory reversed variant.
- Do not crop the mark or use fragments of it as a decorative pattern without sign-off.

---

## 5. Layout and composition

- Flat, paper-like surfaces. Precise hairline rules in Graphite. Square or minimally
  rounded controls.
- Generous negative space. The deck's authority comes from restraint, not density.
- Editorial structure over generic card grids — indexed rows, numbered sections,
  ruled dividers.
- Motion is authored and restrained; all transitions must respect
  `prefers-reduced-motion`.

---

## 6. Web token mapping

Tailwind v4 tokens in `packages/ui`:

```css
@theme {
  --color-obsidian: #111111;
  --color-ivory:    #F4F2ED;
  --color-graphite: #35373B;
  --color-violet:   #5E4FB3;
}
```

Semantic mapping shared by all apps:

| Semantic | Value |
| -------- | ----- |
| `background` | Soft Ivory |
| `foreground` | Obsidian Black |
| `muted-foreground` | Graphite Gray |
| `border` | Graphite Gray (low opacity) |
| `primary` | Electric Violet |
| `primary-foreground` | Soft Ivory |
| `ring` | Electric Violet |

Apps may **theme** these tokens. Apps may **not** fork the shadcn primitives in
`packages/ui` (platform SDD §8).

---

## 7. App-specific extensions

Each app may extend the palette with accessible tones for its own domain. Electric
Violet remains the only primary-action colour in every app.

**Academy** (`apps/academy`):

| Name | Hex | Role |
| ---- | --- | ---- |
| Deep Ink | `#211C35` | Editorial dark surface |
| Pale Lilac | `#DED9EF` | Tinted panels, progress track |
| Paper | `#FBFAF7` | Reading surface for lesson content |

---

## 8. Open items

1. **Serif conflict.** `docs/sdd/02-academy.md` §8 specifies **Source Serif 4** for
   editorial display and long-form lesson copy. This brand deck specifies no serif at
   all — Inter/Neue Haas Grotesk for display, Akzidenz-Grotesk as the alternative.
   Either Academy has an approved deviation that needs recording here, or the Academy
   SDD needs correcting. **Resolve before building the Academy type scale.**

2. **Wordmark asset colour.** The supplied `4.png` wordmark samples at `#484A49`, not
   Graphite Gray `#35373B`. The deck value is canonical; the PNG appears to be an
   export artefact. Confirm when SVG assets are supplied.

3. **SVG assets outstanding.** All four logo files are 500×220 PNG. Header rendering
   needs SVG. Request from Rak A. [B2].

4. **Reversed logo variant outstanding.** See §4.

5. **Akzidenz-Grotesk licensing** — not needed unless it moves from "alternative" to
   active web use. Currently not loaded.
