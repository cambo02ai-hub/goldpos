export type HlawSlipSize = "58" | "80" | "custom";

export function parseHlawSlipSize(value: string | null): HlawSlipSize {
  return value === "80" || value === "custom" ? value : "58";
}

function millimeters(
  value: string,
  min: number,
  max: number,
  fallback: number
) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(max, Math.max(min, Math.round(parsed)))
    : fallback;
}

export function hlawSlipDimensions(
  size: HlawSlipSize,
  customWidth: string,
  paperLength: string
) {
  return {
    width:
      size === "custom"
        ? millimeters(customWidth, 40, 100, 58)
        : size === "80"
          ? 80
          : 58,
    length: millimeters(paperLength, 50, 500, 180),
  };
}
