import { describe, expect, it } from "vitest";
import {
  calculateHlawKyoot,
  calculateNo2Weight,
  estimateDailyGoldProfit,
  goldWeightParts,
} from "../shared/shop-calculations";

describe("Excel-based shop calculations", () => {
  it("converts weight into kyat, pae and yway for the daily carry-forward", () => {
    expect(goldWeightParts(1.5)).toEqual({ kyat: 1, pae: 8, yway: 0 });
  });

  it("calculates No.2 output as three times incoming Hlaw weight", () => {
    expect(calculateNo2Weight({ kyat: 4, pae: 4, yway: 3 })).toEqual({
      kyat: 12,
      pae: 13,
      yway: 1,
    });
  });

  it("matches the workbook's Hlaw/Tin Kyoot formula", () => {
    const value = calculateHlawKyoot(
      { kyat: 4, pae: 4, yway: 3 },
      { kyat: 3, pae: 13, htwe: 2 }
    );
    expect(value).toBeCloseTo(-12.514619883, 8);
  });

  it("calculates the workbook-style daily gold profit estimate", () => {
    expect(
      estimateDailyGoldProfit({
        sales: 655_345_117,
        purchases: 318_175_156,
        openingValue: 268_614_844,
        closingWeight: { kyat: 3, pae: 2, yway: 2 },
        closingRate: 10_000_000,
      })
    ).toBe(99_961_367);
  });
});
