import { describe, expect, it } from "vitest";
import {
  hlawSlipDimensions,
  parseHlawSlipSize,
} from "../client/src/lib/hlawSlip";

describe("Hlaw invoice paper dimensions", () => {
  it("uses saved preset sizes safely", () => {
    expect(parseHlawSlipSize(null)).toBe("58");
    expect(parseHlawSlipSize("80")).toBe("80");
    expect(parseHlawSlipSize("custom")).toBe("custom");
    expect(parseHlawSlipSize("invalid")).toBe("58");
  });

  it("applies the chosen length to both preset widths", () => {
    expect(hlawSlipDimensions("58", "99", "140")).toEqual({
      width: 58,
      length: 140,
    });
    expect(hlawSlipDimensions("80", "42", "220")).toEqual({
      width: 80,
      length: 220,
    });
  });

  it("allows custom width and clamps paper dimensions", () => {
    expect(hlawSlipDimensions("custom", "72", "175")).toEqual({
      width: 72,
      length: 175,
    });
    expect(hlawSlipDimensions("custom", "12", "20")).toEqual({
      width: 40,
      length: 50,
    });
    expect(hlawSlipDimensions("custom", "200", "900")).toEqual({
      width: 100,
      length: 500,
    });
    expect(hlawSlipDimensions("custom", "", "not a number")).toEqual({
      width: 58,
      length: 180,
    });
  });
});
