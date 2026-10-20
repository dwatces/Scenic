// Test-time fixtures that are too big to commit. Generated with a canvas in
// the test browser into e2e/.fixtures/ (gitignored), once per checkout.
import fs from "node:fs";

const DIR = new URL("./.fixtures/", import.meta.url);

/**
 * A 4000 x 3000 px JPEG of about 6 MB (a gradient with grain, which JPEG
 * compresses poorly, like a phone photo). Over the API's 3 MB limit, so it
 * only uploads if the client resizes it first.
 * @param {import("@playwright/test").Browser} browser
 * @returns {Promise<string>} the file path
 */
export async function largePhoto(browser) {
  const file = new URL("large-4000x3000.jpg", DIR);
  if (fs.existsSync(file)) return file.pathname;
  fs.mkdirSync(DIR, { recursive: true });

  const page = await browser.newPage();
  const base64 = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 4000;
    canvas.height = 3000;
    const context = canvas.getContext("2d");
    const gradient = context.createLinearGradient(0, 0, 4000, 3000);
    gradient.addColorStop(0, "#1d3b5a");
    gradient.addColorStop(0.5, "#5a8f6a");
    gradient.addColorStop(1, "#d8b46a");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 4000, 3000);
    const pixels = context.getImageData(0, 0, 4000, 3000);
    let seed = 42;
    const random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5;
    for (let i = 0; i < pixels.data.length; i += 4) {
      const grain = random() * 56;
      pixels.data[i] += grain;
      pixels.data[i + 1] += grain;
      pixels.data[i + 2] += grain;
    }
    context.putImageData(pixels, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  });
  await page.close();
  fs.writeFileSync(file, Buffer.from(base64, "base64"));
  return file.pathname;
}
