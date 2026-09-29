import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const publicDirectory = new URL("../client/public/", import.meta.url);
const manifest = JSON.parse(
  readFileSync(new URL("manifest.webmanifest", publicDirectory), "utf8")
) as {
  start_url: string;
  scope: string;
  display: string;
  theme_color: string;
  icons: Array<{ src: string; sizes: string; type: string; purpose: string }>;
};

function pngDimensions(relativePath: string) {
  const bytes = readFileSync(
    fileURLToPath(new URL(relativePath, publicDirectory))
  );
  expect(bytes.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  );
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("iOS/iPadOS installable web app", () => {
  it("launches in standalone mode at the same-origin app root", () => {
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBe("#276044");
  });

  it("provides standard and maskable app icons", () => {
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: "192x192", purpose: "any" }),
        expect.objectContaining({ sizes: "512x512", purpose: "any" }),
        expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
      ])
    );
    expect(pngDimensions("icons/goldpos-192.png")).toEqual({
      width: 192,
      height: 192,
    });
    expect(pngDimensions("icons/goldpos-512.png")).toEqual({
      width: 512,
      height: 512,
    });
    expect(pngDimensions("icons/goldpos-512-maskable.png")).toEqual({
      width: 512,
      height: 512,
    });
  });

  it("includes the iOS Home Screen touch icon", () => {
    expect(pngDimensions("apple-touch-icon.png")).toEqual({
      width: 180,
      height: 180,
    });
  });
});
