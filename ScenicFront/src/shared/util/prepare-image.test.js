import { describe, it, expect, vi } from "vitest";

import { prepareImage, fitWithin, WRONG_TYPE, UNREADABLE, TARGET_BYTES } from "./prepare-image";

/**
 * A stand-in for <canvas>: records what was drawn and how it was encoded.
 * `encodeAs(type, quality)` decides the blob each toBlob call returns.
 */
function fakeCanvasFactory(encodeAs) {
  const canvases = [];
  const makeCanvas = () => {
    const canvas = {
      width: 0,
      height: 0,
      calls: [],
      getContext: () => ({
        drawImage: vi.fn(),
        fillRect: vi.fn(),
        fillStyle: "",
      }),
      toBlob(callback, type, quality) {
        canvas.calls.push({ type, quality });
        callback(encodeAs(type, quality));
      },
    };
    canvases.push(canvas);
    return canvas;
  };
  return { makeCanvas, canvases };
}

const blobOf = (type, size) => new Blob([new Uint8Array(size)], { type });
const photo = (type = "image/jpeg", name = "IMG_0001.JPG") =>
  new File([new Uint8Array(10)], name, { type });
const bitmap = (width, height) => ({ width, height, close: vi.fn() });

describe("fitWithin", () => {
  it("scales the long edge down to 1600 px and never enlarges", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1, 1)).toEqual({ width: 1, height: 1 });
  });
});

describe("prepareImage", () => {
  it("refuses a GIF (or anything but JPEG, PNG, WebP) without decoding it", async () => {
    const decode = vi.fn();
    await expect(prepareImage(photo("image/gif", "a.gif"), { decode })).rejects.toThrow(WRONG_TYPE);
    await expect(prepareImage(photo("", "a.heic"), { decode })).rejects.toThrow(WRONG_TYPE);
    expect(decode).not.toHaveBeenCalled();
  });

  it("says so when the file can't be decoded", async () => {
    const decode = vi.fn(async () => {
      throw new Error("InvalidStateError");
    });
    await expect(prepareImage(photo(), { decode })).rejects.toThrow(UNREADABLE);
  });

  it("re-encodes a 4000 x 3000 photo as a 1600 x 1200 WebP, upright", async () => {
    const { makeCanvas, canvases } = fakeCanvasFactory((type) => blobOf(type, 200 * 1024));
    const decode = vi.fn(async () => bitmap(4000, 3000));
    const file = await prepareImage(photo(), { decode, makeCanvas });
    expect(decode).toHaveBeenCalledTimes(1);
    expect(canvases[0]).toMatchObject({ width: 1600, height: 1200 });
    expect(canvases[0].calls).toEqual([{ type: "image/webp", quality: 0.82 }]);
    expect(file.type).toBe("image/webp");
    expect(file.name).toBe("IMG_0001.webp");
  });

  it("re-encodes even a small photo (so its metadata never travels)", async () => {
    const { makeCanvas, canvases } = fakeCanvasFactory((type) => blobOf(type, 1000));
    const file = await prepareImage(photo("image/jpeg", "tiny.jpg"), {
      decode: async () => bitmap(1, 1),
      makeCanvas,
    });
    expect(canvases[0].calls).toHaveLength(1);
    expect(file.type).toBe("image/webp");
  });

  it("falls back to JPEG when asked-for WebP comes back as PNG (Safari)", async () => {
    const { makeCanvas, canvases } = fakeCanvasFactory((type) =>
      type === "image/webp" ? blobOf("image/png", 900 * 1024) : blobOf(type, 300 * 1024),
    );
    const file = await prepareImage(photo("image/png", "screen.png"), {
      decode: async () => bitmap(1200, 800),
      makeCanvas,
    });
    expect(file.type).toBe("image/jpeg");
    expect(file.name).toBe("screen.jpg");
    expect(canvases[0].calls).toEqual([{ type: "image/webp", quality: 0.82 }]);
    expect(canvases[1].calls).toEqual([{ type: "image/jpeg", quality: 0.85 }]);
  });

  it("steps the quality down until the file fits 600 KB", async () => {
    const sizes = { 0.82: 900, 0.72: 700, 0.62: 500 };
    const { makeCanvas, canvases } = fakeCanvasFactory((type, quality) =>
      blobOf(type, sizes[quality] * 1024),
    );
    const file = await prepareImage(photo(), {
      decode: async () => bitmap(4000, 3000),
      makeCanvas,
    });
    expect(canvases[0].calls.map((call) => call.quality)).toEqual([0.82, 0.72, 0.62]);
    expect(file.size).toBeLessThanOrEqual(TARGET_BYTES);
  });
});
