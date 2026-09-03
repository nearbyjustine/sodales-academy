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
});
