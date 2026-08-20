// One-off image optimization pass: generates responsive WebP assets and a favicon set.
// Run with: node scripts/optimize-images.js
// Safe to delete after running — outputs are committed as static assets, not build artifacts.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const STUDIO_DIR = path.join(ROOT, 'assets', 'Studio');
const ASSETS_DIR = path.join(ROOT, 'assets');

async function optimizeStudioPhotos() {
  const files = fs.readdirSync(STUDIO_DIR).filter((f) => /\.jpe?g$/i.test(f));
  for (const file of files) {
    const input = path.join(STUDIO_DIR, file);
    const base = path.parse(file).name;
    const img = sharp(input).rotate();
    const meta = await img.metadata();
    const targetWidth = Math.min(1200, meta.width);

    await sharp(input)
      .rotate()
      .resize({ width: targetWidth, withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true, progressive: true })
      .toFile(path.join(STUDIO_DIR, `${base}.jpg.tmp`));
    fs.renameSync(path.join(STUDIO_DIR, `${base}.jpg.tmp`), input);

    await sharp(input)
      .resize({ width: targetWidth, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toFile(path.join(STUDIO_DIR, `${base}.webp`));

    console.log(`studio/${file} -> optimized jpg + webp (w=${targetWidth})`);
  }
}

async function optimizeHero() {
  const input = path.join(ASSETS_DIR, 'hero1.jpg');
  const sizes = [
    { suffix: '', width: 1920 },
    { suffix: '-mobile', width: 900 },
  ];
  for (const { suffix, width } of sizes) {
    await sharp(input)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true, progressive: true })
      .toFile(path.join(ASSETS_DIR, `hero1${suffix}.jpg.tmp`));
    await sharp(path.join(ASSETS_DIR, `hero1${suffix}.jpg.tmp`))
      .webp({ quality: 76 })
      .toFile(path.join(ASSETS_DIR, `hero1${suffix}.webp`));
  }
  fs.renameSync(path.join(ASSETS_DIR, 'hero1-mobile.jpg.tmp'), path.join(ASSETS_DIR, 'hero1-mobile.jpg'));
  fs.renameSync(path.join(ASSETS_DIR, 'hero1.jpg.tmp'), path.join(ASSETS_DIR, 'hero1.jpg'));
  console.log('hero1.jpg -> optimized + webp (desktop 1920w, mobile 900w)');
}

async function buildFavicons() {
  const logo = path.join(ASSETS_DIR, 'somastronglogo.png');
  // Crop the swirl "S" monogram out of the wordmark lockup (hand-tuned box, source is a flat PNG with no layers).
  const mark = sharp(logo).extract({ left: 385, top: 0, width: 235, height: 235 });

  const outDir = path.join(ROOT, 'public', 'icons');
  fs.mkdirSync(outDir, { recursive: true });

  const squareSizes = [16, 32, 48, 180, 192, 512];
  for (const size of squareSizes) {
    await mark
      .clone()
      .resize({
        width: Math.round(size * 0.86),
        height: Math.round(size * 0.86),
        fit: 'contain',
        background: '#ffffff',
      })
      .extend({
        top: Math.round(size * 0.07),
        bottom: Math.round(size * 0.07),
        left: Math.round(size * 0.07),
        right: Math.round(size * 0.07),
        background: '#ffffff',
      })
      .resize(size, size)
      .png()
      .toFile(path.join(outDir, `icon-${size}.png`));
  }
  fs.copyFileSync(path.join(outDir, 'icon-32.png'), path.join(ROOT, 'public', 'favicon.png'));
  fs.copyFileSync(path.join(outDir, 'icon-180.png'), path.join(outDir, 'apple-touch-icon.png'));
  console.log('favicon set generated in public/icons/');
}

(async () => {
  await optimizeStudioPhotos();
  await optimizeHero();
  await buildFavicons();
  console.log('Done.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
