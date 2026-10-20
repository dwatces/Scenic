import { describe, it, expect, vi } from "vitest";

import {
  prepareImage,
  fitWithin,
  WRONG_TYPE,
  UNREADABLE,
  TARGET_BYTES,
  CARD_EDGE,
  CARD_TARGET_BYTES,
} from "./prepare-image";

/**
 * A stand-in for <canvas>: records what was drawn and how it was encoded.
 * `encodeAs(type, quality)` decides the blob each toBlob call returns.
 */
function fakeCanvasFactory(encodeAs) {
  const canvases = [];
  const makeCanvas = () => {
    const context = { drawImage: vi.fn(), fillRect: vi.fn(), fillStyle: "" };
    const canvas = {
      width: 0,
      height: 0,
      calls: [],
      context,
      getContext: () => context,
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

  it("fits a card copy within 640 px", () => {
    expect(fitWithin(1600, 1200, CARD_EDGE)).toEqual({ width: 640, height: 480 });
    expect(fitWithin(1200, 1600, CARD_EDGE)).toEqual({ width: 480, height: 640 });
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

describe("prepareImage with a card copy", () => {
  it("makes the photo and a 640 px WebP card from one decode", async () => {
    const { makeCanvas, canvases } = fakeCanvasFactory((type, quality) =>
      blobOf(type, quality === 0.82 ? 200 * 1024 : 40 * 1024),
    );
    const decode = vi.fn(async () => bitmap(4000, 3000));
    const { image, thumb } = await prepareImage(photo(), { card: true, decode, makeCanvas });
    expect(decode).toHaveBeenCalledTimes(1);
    expect(image.type).toBe("image/webp");
    expect(image.name).toBe("IMG_0001.webp");
    expect(canvases).toHaveLength(2);
    expect(canvases[1]).toMatchObject({ width: 640, height: 480 });
    // Drawn from the prepared photo, so it is upright too.
    expect(canvases[1].context.drawImage).toHaveBeenCalledWith(canvases[0], 0, 0, 640, 480);
    expect(canvases[1].calls).toEqual([{ type: "image/webp", quality: 0.72 }]);
    expect(thumb.type).toBe("image/webp");
    expect(thumb.name).toBe("IMG_0001-card.webp");
    expect(thumb.size).toBeLessThanOrEqual(CARD_TARGET_BYTES);
  });

  it("steps the card's quality down until it fits 60 KB", async () => {
    const cardSizes = { 0.72: 90, 0.62: 70, 0.52: 55 };
    const { makeCanvas, canvases } = fakeCanvasFactory((type, quality) =>
      blobOf(type, (canvases.length === 1 ? 300 : cardSizes[quality]) * 1024),
    );
    const { thumb } = await prepareImage(photo(), {
      card: true,
      decode: async () => bitmap(3000, 4000),
      makeCanvas,
    });
    expect(canvases[1]).toMatchObject({ width: 480, height: 640 });
    expect(canvases[1].calls.map((call) => call.quality)).toEqual([0.72, 0.62, 0.52]);
    expect(thumb.size).toBeLessThanOrEqual(CARD_TARGET_BYTES);
  });

  it("never enlarges a small photo's card", async () => {
    const { makeCanvas, canvases } = fakeCanvasFactory((type) => blobOf(type, 1000));
    await prepareImage(photo(), { card: true, decode: async () => bitmap(500, 300), makeCanvas });
    expect(canvases[1]).toMatchObject({ width: 500, height: 300 });
  });

  it("makes a JPEG card from the white-backed canvas when WebP isn't available (Safari)", async () => {
    const { makeCanvas, canvases } = fakeCanvasFactory((type) =>
      type === "image/webp" ? blobOf("image/png", 900 * 1024) : blobOf(type, 40 * 1024),
    );
    const { image, thumb } = await prepareImage(photo("image/png", "screen.png"), {
      card: true,
      decode: async () => bitmap(1200, 800),
      makeCanvas,
    });
    expect(image.type).toBe("image/jpeg");
    expect(canvases).toHaveLength(3);
    expect(canvases[2].context.drawImage).toHaveBeenCalledWith(canvases[1], 0, 0, 640, 427);
    expect(canvases[2].calls).toEqual([{ type: "image/jpeg", quality: 0.75 }]);
    expect(thumb.type).toBe("image/jpeg");
    expect(thumb.name).toBe("screen-card.jpg");
  });

  it("leaves the card out when it can't be made small enough for the API", async () => {
    const { makeCanvas } = fakeCanvasFactory((type) => blobOf(type, 400 * 1024));
    const { image, thumb } = await prepareImage(photo(), {
      card: true,
      decode: async () => bitmap(4000, 3000),
      makeCanvas,
    });
    expect(image.type).toBe("image/webp");
    expect(thumb).toBeNull();
  });
});
