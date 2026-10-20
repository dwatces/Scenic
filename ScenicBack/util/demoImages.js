// The demo images in assets/demo/ (built by scripts/make-demo-images.py),
// read once. Demo mode serves them and the seeder copies them, so both take
// their bytes from here.
//
// Each path is a literal path.join(__dirname, ...) so Vercel's file tracer
// sees the files and bundles them with the function. Keep it that way: a
// path built from a variable, process.cwd() or env would leave them out.
const fs = require("fs");
const path = require("path");

module.exports = {
  milfordSound: fs.readFileSync(path.join(__dirname, "..", "assets", "demo", "milford-sound.webp")),
  lakeTekapo: fs.readFileSync(path.join(__dirname, "..", "assets", "demo", "lake-tekapo.webp")),
  cathedralCove: fs.readFileSync(
    path.join(__dirname, "..", "assets", "demo", "cathedral-cove.webp"),
  ),
  // 640 px copies of the same photos, for scene cards.
  milfordSoundCard: fs.readFileSync(
    path.join(__dirname, "..", "assets", "demo", "milford-sound-card.webp"),
  ),
  lakeTekapoCard: fs.readFileSync(
    path.join(__dirname, "..", "assets", "demo", "lake-tekapo-card.webp"),
  ),
  cathedralCoveCard: fs.readFileSync(
    path.join(__dirname, "..", "assets", "demo", "cathedral-cove-card.webp"),
  ),
  avatarDaniel: fs.readFileSync(path.join(__dirname, "..", "assets", "demo", "avatar-daniel.webp")),
  avatarAroha: fs.readFileSync(path.join(__dirname, "..", "assets", "demo", "avatar-aroha.webp")),
};
