/**
 * Image Optimization Script for HDTube Saver
 * Run: node scripts/optimize-images.js
 * Compresses images to WebP and AVIF formats using sharp
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const INPUT_DIR = path.join(__dirname, '..', 'src', 'assets');
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'assets', 'optimized');

const QUALITY = {
  webp: 80,
  avif: 60,
};

async function optimizeImages() {
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Find all image files
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
  const images = [];

  function findImages(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'optimized' && entry.name !== 'favicons') {
          findImages(fullPath);
        }
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (imageExtensions.includes(ext)) {
          images.push(fullPath);
        }
      }
    }
  }

  findImages(INPUT_DIR);

  console.log(`Found ${images.length} images to optimize\n`);

  for (const imagePath of images) {
    const relativePath = path.relative(INPUT_DIR, imagePath);
    const baseName = path.basename(imagePath, path.extname(imagePath));
    const subDir = path.dirname(relativePath);

    const outputSubDir = path.join(OUTPUT_DIR, subDir);
    if (!fs.existsSync(outputSubDir)) {
      fs.mkdirSync(outputSubDir, { recursive: true });
    }

    try {
      const image = sharp(imagePath);
      const metadata = await image.metadata();

      // Generate WebP
      const webpPath = path.join(outputSubDir, `${baseName}.webp`);
      await image
        .clone()
        .webp({ quality: QUALITY.webp })
        .toFile(webpPath);

      // Generate AVIF
      const avifPath = path.join(outputSubDir, `${baseName}.avif`);
      await image
        .clone()
        .avif({ quality: QUALITY.avif })
        .toFile(avifPath);

      // Generate optimized PNG (fallback)
      const optimizedPngPath = path.join(outputSubDir, `${baseName}.png`);
      await image
        .clone()
        .png({ quality: 90, compressionLevel: 9 })
        .toFile(optimizedPngPath);

      // Generate responsive sizes
      const sizes = [320, 640, 1280];
      for (const width of sizes) {
        if (metadata.width && metadata.width > width) {
          const resizedWebp = path.join(
            outputSubDir,
            `${baseName}-${width}w.webp`
          );
          await image
            .clone()
            .resize(width, null, { withoutEnlargement: true })
            .webp({ quality: QUALITY.webp })
            .toFile(resizedWebp);
        }
      }

      const stats = fs.statSync(imagePath);
      console.log(`✓ ${relativePath} (${(stats.size / 1024).toFixed(1)} KB)`);
    } catch (error) {
      console.error(`✗ ${relativePath}: ${error.message}`);
    }
  }

  console.log('\n✅ Image optimization complete!');
  console.log(`   Output: ${OUTPUT_DIR}`);
}

optimizeImages().catch(console.error);
