import { describe, expect, it } from "vitest";
import { fitSize } from "./logo";

describe("fitSize", () => {
  it("réduit le plus grand côté à 512 en gardant les proportions", () => {
    expect(fitSize(2048, 1024)).toEqual({ width: 512, height: 256 });
    expect(fitSize(600, 1200)).toEqual({ width: 256, height: 512 });
  });
  it("n'agrandit pas un raster", () => {
    expect(fitSize(200, 100)).toEqual({ width: 200, height: 100 });
  });
  it("agrandit un vectoriel", () => {
    expect(fitSize(100, 50, 512, true)).toEqual({ width: 512, height: 256 });
  });
  it("ne descend jamais sous 1 px", () => {
    expect(fitSize(5000, 1)).toEqual({ width: 512, height: 1 });
  });
});
