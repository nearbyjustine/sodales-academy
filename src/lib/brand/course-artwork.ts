/**
 * Deterministic cover artwork derived from the Sodales mark.
 *
 * The mark is two ribbons cut on a single shear axis, each ending in an arrow.
 * `MARK_SHEAR` is that axis, measured off the supplied `mark.png` artwork
 * (leading edge runs 34px across over 69px down = 26.2deg off vertical), so the
 * generated covers lean on exactly the same angle as the logo rather than an
 * invented one.
 *
 * Everything here is pure and seeded by the course slug: the same course always
 * gets the same cover, and a new course gets art the moment it exists — no
 * upload step, no blank state.
 */

export const MARK_SHEAR_DEG = 26.2;
/** Horizontal run per unit of vertical drop, i.e. tan(26.2deg). */
export const MARK_SHEAR = 0.4899;

/** The field every cover is drawn in. Covers are cropped by their viewBox. */
const FIELD = 100;

/** Violet family on Deep Ink. Every cover carries its own ground, so it reads
 *  the same on Ivory cards and inside the Obsidian footer band. */
const GROUND = "#211c35";

/**
 * Tones are assigned by role, not picked at random: a cover is mostly near-
 * ground bands with two Electric Violet ribbons and a single light accent.
 * Sampling all four uniformly gave every cover the same candy-stripe weight and
 * fought the type sitting on top of it.
 */
const ROLE_TONE = {
  deep: "#2e2748",
  violet: "#5e4fb3",
  light: "#887bd8",
} as const;

type Role = keyof typeof ROLE_TONE;

export type ArtworkBand = {
  /** Polygon points, already sheared, as an SVG `points` string. */
  points: string;
  fill: string;
  opacity: number;
};

export type CourseArtwork = {
  ground: string;
  bands: ArtworkBand[];
};

/** FNV-1a. Small, stable across runtimes, and good enough to decorrelate slugs. */
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic 0..1 stream seeded by `hash`. */
function stream(seed: number) {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0xffffffff;
  };
}

const pt = (x: number, y: number) => `${x.toFixed(2)},${y.toFixed(2)}`;

/** A plain sheared band running the full height of the field. */
function band(x: number, w: number): string {
  const drop = MARK_SHEAR * FIELD;
  return [pt(x, 0), pt(x + w, 0), pt(x + w - drop, FIELD), pt(x - drop, FIELD)].join(" ");
}

/**
 * A band that stops partway down and terminates in the mark's arrowhead.
 * This is the one quotation of the logo's own cut; exactly one band per cover
 * gets it, so it reads as a signature rather than a pattern.
 */
function arrowBand(x: number, w: number, stopAt: number): string {
  const head = 14;
  const dx = (y: number) => x - MARK_SHEAR * y;
  return [
    pt(x, 0),
    pt(x + w, 0),
    pt(dx(stopAt) + w, stopAt),
    pt(dx(stopAt + head) + w / 2, stopAt + head),
    pt(dx(stopAt), stopAt),
  ].join(" ");
}

/**
 * @param seed  Course slug — stable for the life of the course.
 * @param lessonCount Drives band density, so a longer course reads as a denser
 *   field. That is the one thing the artwork actually encodes.
 */
export function courseArtwork(seed: string, lessonCount: number): CourseArtwork {
  const rand = stream(hash(seed));
  const count = Math.min(9, Math.max(4, lessonCount));

  // A band leans left as it falls, so its bottom edge sits a full shear drop
  // left of its top edge. Lay the tops out across [0, FIELD + drop] — that is
  // the range whose bottoms cover [-drop, FIELD]. Starting at -drop instead
  // (the obvious-looking choice) pushes most of the field off the left edge and
  // leaves the top-right corner bare.
  const drop = MARK_SHEAR * FIELD;
  // A band whose top sits at x is only visible while x > -w (its right edge has
  // not cleared the left side) and x - drop < FIELD (its bottom edge has not
  // cleared the right side). Bands can be hairline-thin, so w carries no useful
  // margin: lay the tops out over [0, FIELD + drop) exactly. Bleeding past
  // either end just buys an invisible band.
  //
  // Bare ground at a corner is fine and intended — Deep Ink is the cover's
  // ground colour, not a hole.
  const start = 0;
  const span = FIELD + drop - 4;
  const slot = span / count;

  // Roles first, so the accents land on known bands rather than by luck.
  const roles: Role[] = Array.from({ length: count }, () => "deep");
  const accents: number[] = [];
  while (accents.length < 3) {
    const i = Math.floor(rand() * count);
    if (!accents.includes(i)) accents.push(i);
  }
  roles[accents[0]] = "violet";
  roles[accents[1]] = "violet";
  roles[accents[2]] = "light";

  // The arrow band stops partway down instead of running to y=100, so it never
  // swings as far left as a full band does — an outer slot that is fine for a
  // full band puts the arrow entirely off-canvas. Place it in the middle of the
  // layout, where its head lands inside the field at every band count. The
  // arrow is the cover's only direct quotation of the mark; it has to be seen.
  const arrowAt = Math.floor(count * (0.25 + rand() * 0.4));

  const bands: ArtworkBand[] = [];
  for (let i = 0; i < count; i += 1) {
    // Alternate wide ribbons with hairlines so the field has rhythm instead of
    // reading as evenly-spaced stripes.
    // Consume the roll unconditionally so the sequence stays stable; the arrow
    // band is always wide, because an arrowhead on a hairline is just a spike.
    const roll = rand() > 0.42;
    const wide = i === arrowAt || roll;
    const w = slot * (wide ? 0.42 + rand() * 0.38 : 0.05 + rand() * 0.12);
    const x = start + i * slot + rand() * Math.max(0, slot - w);
    const role = roles[i];
    const opacity =
      role === "deep" ? 0.45 + rand() * 0.45 : role === "violet" ? 0.5 + rand() * 0.3 : 0.55 + rand() * 0.3;

    bands.push({
      points: i === arrowAt ? arrowBand(x, w, 24 + rand() * 30) : band(x, w),
      fill: ROLE_TONE[role],
      opacity: Number(opacity.toFixed(2)),
    });
  }

  return { ground: GROUND, bands };
}
