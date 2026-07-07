// Strips the background from the AI-generated character art (assets/*.jpg)
// and saves transparent .png sprites. Uses an ML segmentation model
// (@imgly/background-removal-node) because several source images have full
// illustrated scenes behind the character, which color-threshold removal
// cannot handle.
const { removeBackground } = require('@imgly/background-removal-node');
const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '../assets');

// Crop to the character's opaque bounding box (expanded to a square with a
// little padding) so the sprite fills its in-game display size instead of
// floating in a huge transparent canvas.
async function trimToSquare(buffer) {
    const img = await Jimp.read(buffer);
    const { width, height, data } = img.bitmap;
    let minX = width, maxX = -1, minY = height, maxY = -1;
    img.scan(0, 0, width, height, (x, y, idx) => {
        if (data[idx + 3] > 10) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    });
    if (maxX < 0) return buffer; // fully transparent, leave as-is

    const pad = 8;
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const size = Math.max(w, h) + pad * 2;
    // Center the bounding box inside the square, clamped to the image
    let cx = Math.max(0, Math.min(width - size, minX - Math.floor((size - w) / 2)));
    let cy = Math.max(0, Math.min(height - size, minY - Math.floor((size - h) / 2)));
    img.crop(cx, cy, Math.min(size, width), Math.min(size, height));
    return img.getBufferAsync(Jimp.MIME_PNG);
}

async function processImage(filename) {
    if (!filename.endsWith('.jpg') || filename === 'classroom_bg.jpg') return;

    const inputPath = path.join(assetsDir, filename);
    const outputPath = path.join(assetsDir, filename.replace('.jpg', '.png'));

    console.log(`Processing ${filename}...`);
    const blob = new Blob([fs.readFileSync(inputPath)], { type: 'image/jpeg' });
    const result = await removeBackground(blob, { output: { format: 'image/png' } });
    const trimmed = await trimToSquare(Buffer.from(await result.arrayBuffer()));
    fs.writeFileSync(outputPath, trimmed);
    console.log(`Saved ${outputPath}`);
}

async function main() {
    const files = fs.readdirSync(assetsDir);
    for (const file of files) {
        await processImage(file);
    }
}

main().catch(e => { console.error(e); process.exit(1); });
