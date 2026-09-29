import { describe, expect, it } from "vitest";
import {
  defaultSlipLengthMm,
  normalizeSlipLengthMm,
} from "../shared/receipt-print";

describe("receipt paper length", () => {
  it("uses 120mm as the default for 80mm paper", () => {
    expect(defaultSlipLengthMm("80")).toBe(120);
    expect(normalizeSlipLengthMm("", "80")).toBe(120);
  });

  it("preserves the existing 140mm default for 58mm paper", () => {
    expect(defaultSlipLengthMm("58")).toBe(140);
    expect(normalizeSlipLengthMm("invalid", "58")).toBe(140);
  });

  it("accepts a custom length in millimeters", () => {
    expect(normalizeSlipLengthMm("185", "80")).toBe(185);
  });

  it("rounds and clamps lengths to the supported 80–300mm range", () => {
    expect(normalizeSlipLengthMm(79, "80")).toBe(80);
    expect(normalizeSlipLengthMm(301, "80")).toBe(300);
    expect(normalizeSlipLengthMm(121.6, "80")).toBe(122);
  });
});
