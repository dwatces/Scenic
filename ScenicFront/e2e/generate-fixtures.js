// Test-time fixtures that are too big to commit. Drawn on a canvas in
// the test browser into e2e/.fixtures/ (gitignored), once per checkout.
import fs from "node:fs";

const DIR = new URL("./.fixtures/", import.meta.url);

/**
 * Draw a grainy gradient on a canvas in the test browser and save it as a
 * JPEG in e2e/.fixtures/.
 * @param {import("@playwright/test").Browser} browser
 * @param {string} name file name inside e2e/.fixtures/
 * @param {{ width: number, height: number, grain: number, quality: number }} options
 * @returns {Promise<string>} the file path
 */
async function drawPhoto(browser, name, options) {
  const file = new URL(name, DIR);
  if (fs.existsSync(file)) return file.pathname;
  fs.mkdirSync(DIR, { recursive: true });

  const page = await browser.newPage();
  const base64 = await page.evaluate(async ({ width, height, grain, quality }) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#1d3b5a");
    gradient.addColorStop(0.5, "#5a8f6a");
    gradient.addColorStop(1, "#d8b46a");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height);
    let seed = 42;
    const random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5;
    for (let i = 0; i < pixels.data.length; i += 4) {
      const noise = random() * grain;
      pixels.data[i] += noise;
      pixels.data[i + 1] += noise;
      pixels.data[i + 2] += noise;
    }
    context.putImageData(pixels, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  }, options);
  await page.close();
  fs.writeFileSync(file, Buffer.from(base64, "base64"));
  return file.pathname;
}

/**
 * A 4000 x 3000 px JPEG of about 6 MB (a gradient with grain, which JPEG
 * compresses poorly, like a phone photo). Over the API's 3 MB limit, so it
 * only uploads if the client resizes it first.
 * @param {import("@playwright/test").Browser} browser
 * @returns {Promise<string>} the file path
 */
export const largePhoto = (browser) =>
  drawPhoto(browser, "large-4000x3000.jpg", {
    width: 4000,
    height: 3000,
    grain: 56,
    quality: 0.92,
  });

/**
 * A 1000 x 1500 px portrait JPEG (2:3, the shape of most phone photos), well
 * under the API's 3 MB limit so it can be posted as it is.
 * @param {import("@playwright/test").Browser} browser
 * @returns {Promise<string>} the file path
 */
export const portraitPhoto = (browser) =>
  drawPhoto(browser, "portrait-1000x1500.jpg", {
    width: 1000,
    height: 1500,
    grain: 24,
    quality: 0.85,
  });
