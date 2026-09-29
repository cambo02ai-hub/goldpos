export type SlipSize = "58" | "80";

export const defaultSlipLengthMm = (size: SlipSize) =>
  size === "80" ? 120 : 140;

export function normalizeSlipLengthMm(
  value: string | number,
  size: SlipSize
): number {
  const parsed =
    typeof value === "string" && value.trim() === "" ? NaN : Number(value);
  if (!Number.isFinite(parsed)) return defaultSlipLengthMm(size);
  return Math.max(80, Math.min(300, Math.round(parsed)));
}
