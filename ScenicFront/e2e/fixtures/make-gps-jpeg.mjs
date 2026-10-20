// Writes e2e/fixtures/gps-1x1.jpg: a 1 x 1 px JPEG carrying an EXIF block
// with a GPS position (central Auckland). The upload test checks that
// Scenic's in-browser re-encode strips it. Built byte by byte here, so the
// fixture has no licence question. Usage: node e2e/fixtures/make-gps-jpeg.mjs
import { writeFileSync } from "node:fs";

// A plain 1 x 1 px baseline JPEG (JFIF, no metadata).
const PLAIN_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQgJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDh6KKKwPIP/9k=",
  "base64",
);

// TIFF, little-endian: IFD0 with one entry (the GPS IFD pointer), then the
// GPS IFD (version, latitude S 36 50 54.6, longitude E 174 45 47.9).
const tiff = Buffer.alloc(140);
let at = 0;
const u16 = (value) => (tiff.writeUInt16LE(value, at), (at += 2));
const u32 = (value) => (tiff.writeUInt32LE(value, at), (at += 4));
const entry = (tag, type, count, writeValue) => {
  u16(tag);
  u16(type);
  u32(count);
  const start = at;
  writeValue();
  at = start + 4;
};
const BYTE = 1;
const ASCII = 2;
const LONG = 4;
const RATIONAL = 5;

tiff.write("II", 0, "ascii");
at = 2;
u16(42);
u32(8); // IFD0 offset
// IFD0 at 8: 1 entry, next IFD 0. GPS IFD at 8 + 2 + 12 + 4 = 26.
u16(1);
entry(0x8825, LONG, 1, () => u32(26));
u32(0);
// GPS IFD at 26: 5 entries (2 + 60 + 4 = 66 bytes), data from 92.
u16(5);
entry(0x0000, BYTE, 4, () => tiff.set([2, 3, 0, 0], at));
entry(0x0001, ASCII, 2, () => tiff.write("S\0", at, "ascii"));
entry(0x0002, RATIONAL, 3, () => u32(92));
entry(0x0003, ASCII, 2, () => tiff.write("E\0", at, "ascii"));
entry(0x0004, RATIONAL, 3, () => u32(116));
u32(0);
for (const [numerator, denominator] of [
  [36, 1],
  [50, 1],
  [546, 10],
  [174, 1],
  [45, 1],
  [479, 10],
]) {
  u32(numerator);
  u32(denominator);
}

const payload = Buffer.concat([Buffer.from("Exif\0\0", "binary"), tiff]);
const app1 = Buffer.alloc(4);
app1.writeUInt16BE(0xffe1, 0);
app1.writeUInt16BE(payload.length + 2, 2);

// SOI, then the EXIF APP1 segment, then the rest of the plain JPEG.
const jpeg = Buffer.concat([PLAIN_JPEG.subarray(0, 2), app1, payload, PLAIN_JPEG.subarray(2)]);
const out = new URL("./gps-1x1.jpg", import.meta.url);
writeFileSync(out, jpeg);
console.log(`wrote ${out.pathname} (${jpeg.length} bytes)`);
