import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrandWordmark } from "./brand-wordmark";

describe("BrandWordmark", () => {
  it("renders the wordmark as an image, never as live text", () => {
    render(<BrandWordmark />);
    const img = screen.getByAltText("Sodales");
    expect(img).toBeDefined();
    expect(screen.queryByText("SODALES")).toBeNull();
  });

  it("renders the product half of the lockup as text", () => {
    render(<BrandWordmark product="Academy" />);
    expect(screen.getByText("Academy")).toBeDefined();
  });

  it("swaps to the reversed artwork on dark surfaces", () => {
    // The graphite wordmark is illegible on Obsidian; the footer and the intro
    // both sit on it.
    const { container } = render(<BrandWordmark tone="dark" />);
    expect(container.querySelector("img")?.getAttribute("src")).toContain("wordmark-light");
  });

  it("can render the wordmark half alone, for the intro's assembled lockup", () => {
    const { container } = render(<BrandWordmark part="wordmark" tone="dark" />);
    const src = container.querySelector("img")?.getAttribute("src");
    expect(src).toContain("wordmark-text-light");
    // Still artwork, still never live text (brand guidelines §4).
    expect(screen.getByAltText("Sodales")).toBeDefined();
    expect(screen.queryByText("SODALES")).toBeNull();
  });
});
