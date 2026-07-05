const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '../assets');

function colorDistance(r1, g1, b1, r2, g2, b2) {
    return Math.sqrt(Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2));
}

async function processImage(filename) {
    if (!filename.endsWith('.jpg') || filename === 'classroom_bg.jpg') return;
    
    const inputPath = path.join(assetsDir, filename);
    const outputPath = path.join(assetsDir, filename.replace('.jpg', '.png'));
    
    console.log(`Processing ${filename}...`);
    try {
        const image = await Jimp.read(inputPath);
        
        // Use top-left pixel (0,0) as the background color
        const bgIdx = image.getPixelIndex(0, 0);
        const bgR = image.bitmap.data[bgIdx + 0];
        const bgG = image.bitmap.data[bgIdx + 1];
        const bgB = image.bitmap.data[bgIdx + 2];
        
        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
            const r = this.bitmap.data[idx + 0];
            const g = this.bitmap.data[idx + 1];
            const b = this.bitmap.data[idx + 2];
            
            // Use distance threshold of 60 to catch artifacts
            if (colorDistance(r, g, b, bgR, bgG, bgB) < 60) {
                this.bitmap.data[idx + 3] = 0; // Alpha
            }
        });
        
        await image.writeAsync(outputPath);
        console.log(`Saved ${outputPath}`);
    } catch (e) {
        console.error(`Error processing ${filename}:`, e);
    }
}

async function main() {
    const files = fs.readdirSync(assetsDir);
    for (const file of files) {
        await processImage(file);
    }
}

main();
