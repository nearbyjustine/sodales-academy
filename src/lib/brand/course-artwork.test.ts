import { describe, expect, it } from "vitest";
import { MARK_SHEAR, courseArtwork } from "./course-artwork";

/** Parse an SVG `points` string back into coordinate pairs. */
function points(p: string): Array<[number, number]> {
  return p.split(" ").map((pair) => {
    const [x, y] = pair.split(",").map(Number);
    return [x, y] as [number, number];
  });
}

describe("courseArtwork", () => {
  it("is deterministic — the same course always gets the same cover", () => {
    expect(courseArtwork("brand-identity-essentials", 4)).toEqual(
      courseArtwork("brand-identity-essentials", 4),
    );
  });

  it("gives different courses different covers", () => {
    const a = courseArtwork("brand-identity-essentials", 4);
    const b = courseArtwork("landing-your-first-client", 4);
    expect(a.bands).not.toEqual(b.bands);
  });

  it("scales band count with lesson count, clamped to a legible range", () => {
    expect(courseArtwork("x", 1).bands).toHaveLength(4);
    expect(courseArtwork("x", 6).bands).toHaveLength(6);
    expect(courseArtwork("x", 40).bands).toHaveLength(9);
  });

  it("keeps every band inside the visible field", () => {
    // A band leans left as it falls, so it occupies [x - drop, x + w] overall.
    // The first cut of this generator laid the bands out starting a full shear
    // drop to the LEFT, which put several of them entirely off-canvas — the
    // cover looked half-empty and the arrow accent often never appeared at all.
    // Bare ground at a corner is fine (Deep Ink is a deliberate ground, not a
    // hole); a band nobody can see is not.
    for (const seed of ["a", "brand-identity-essentials", "sodales-academy", "x"]) {
      for (const count of [4, 7, 9]) {
        const { bands } = courseArtwork(seed, count);
        bands.forEach((b, i) => {
          const xs = points(b.points).map(([x]) => x);
          expect(Math.min(...xs), `${seed}/${count} band ${i} right edge`).toBeLessThan(100);
          expect(Math.max(...xs), `${seed}/${count} band ${i} left edge`).toBeGreaterThan(0);
        });
      }
    }
  });

  it("leans every full-height band on the mark's measured shear axis", () => {
    const { bands } = courseArtwork("sodales-academy", 9);
    const fullHeight = bands.filter((b) => b.points.includes(",100.00"));
    expect(fullHeight.length).toBeGreaterThan(0);

    for (const b of fullHeight) {
      const pts = points(b.points);
      // The polygon is [topLeft, topRight, bottomRight, bottomLeft]; compare the
      // two LEFT corners, or the width gets folded into the measured slope.
      const [topLeft] = pts;
      const bottomLeft = pts[pts.length - 1];
      expect((topLeft[0] - bottomLeft[0]) / 100).toBeCloseTo(MARK_SHEAR, 2);
    }
  });

  it("puts exactly one arrowhead on every cover, with the head inside the field", () => {
    for (const seed of ["a", "b", "x", "sodales-academy", "pricing-and-proposals"]) {
      for (const count of [4, 5, 7, 9]) {
        const { bands } = courseArtwork(seed, count);
        // The arrow band is the only one that does not reach y=100.
        const arrows = bands.filter((b) => !b.points.includes(",100.00"));
        expect(arrows, `${seed}/${count}`).toHaveLength(1);

        // The head is the single vertex at the band's lowest point. It is the
        // one shape a viewer should recognise, so it has to be on screen.
        const pts = points(arrows[0].points);
        const head = pts.reduce((a, b) => (b[1] > a[1] ? b : a));
        expect(head[0], `${seed}/${count} head x`).toBeGreaterThan(0);
        expect(head[0], `${seed}/${count} head x`).toBeLessThan(100);
      }
    }
  });
});
