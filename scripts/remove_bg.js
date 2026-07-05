const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '../assets');

async function processImage(filename) {
    if (!filename.endsWith('.jpg') || filename === 'classroom_bg.jpg') return;
    
    const inputPath = path.join(assetsDir, filename);
    const outputPath = path.join(assetsDir, filename.replace('.jpg', '.png'));
    
    console.log(`Processing ${filename}...`);
    try {
        const image = await Jimp.read(inputPath);
        
        // Remove white/light background
        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
            const r = this.bitmap.data[idx + 0];
            const g = this.bitmap.data[idx + 1];
            const b = this.bitmap.data[idx + 2];
            
            // If the pixel is very light (close to white), make it transparent
            if (r > 220 && g > 220 && b > 220) {
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
