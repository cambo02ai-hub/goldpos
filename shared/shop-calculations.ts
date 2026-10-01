export type GoldWeightParts = { kyat: number; pae: number; yway: number };

export function goldWeight({ kyat, pae, yway }: GoldWeightParts): number {
  return kyat + pae / 16 + yway / 128;
}

export function goldWeightParts(weight: number): GoldWeightParts {
  const totalTenthYway = Math.max(0, Math.round(weight * 1280));
  const kyat = Math.floor(totalTenthYway / 1280);
  const remainder = totalTenthYway - kyat * 1280;
  const pae = Math.floor(remainder / 80);
  const yway = Math.round(((remainder - pae * 80) / 10) * 10) / 10;
  return { kyat, pae, yway };
}

export type GoldStockBalance = {
  openingWeight: number;
  boughtWeight: number;
  soldWeight: number;
  rawClosingWeight: number;
  expectedClosingWeight: number;
  expectedClosing: GoldWeightParts;
};

/** The single source of truth for the daily stock formula. */
export function calculateStockBalance(input: {
  opening: GoldWeightParts;
  boughtWeight: number;
  soldWeight: number;
}): GoldStockBalance {
  const openingWeight = goldWeight(input.opening);
  const rawClosingWeight =
    openingWeight + input.boughtWeight - input.soldWeight;
  const expectedClosingWeight = Math.max(0, rawClosingWeight);
  return {
    openingWeight,
    boughtWeight: input.boughtWeight,
    soldWeight: input.soldWeight,
    rawClosingWeight,
    expectedClosingWeight,
    expectedClosing: goldWeightParts(expectedClosingWeight),
  };
}

/** Mirrors the worksheet's 7.5-htwe conversion and ×120 yield formula. */
export function calculateHlawKyoot(
  hlaw: GoldWeightParts,
  tin: { kyat: number; pae: number; htwe: number }
): number | null {
  const hlawWeight = hlaw.kyat + hlaw.pae / 16 + hlaw.yway / (7.5 * 16);
  const tinWeight = tin.kyat + tin.pae / 16 + tin.htwe / (7.5 * 16);
  return hlawWeight > 0 ? (tinWeight / hlawWeight - 1) * 120 : null;
}

/** Mirrors the workbook's daily trading-profit line: sales − purchases + closing value − opening value. */
export function estimateDailyGoldProfit(input: {
  sales: number;
  purchases: number;
  openingValue: number;
  closingWeight: GoldWeightParts;
  closingRate: number;
}): number {
  const closingValue = Math.round(
    goldWeight(input.closingWeight) * input.closingRate
  );
  return input.sales - input.purchases + closingValue - input.openingValue;
}
