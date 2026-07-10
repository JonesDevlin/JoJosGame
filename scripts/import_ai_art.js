// One-off: imports the Pollinations-generated playground art (saved by the
// MCP server to its own output folder) into assets/ as .jpg sources, ready
// for scripts/remove_bg.js to strip backgrounds on the character sprites.
const Jimp = require('jimp');
const path = require('path');

const SRC_DIR = 'C:/Users/jdevl/mcp-servers/pollinations-image-mcp/output';

const files = [
    ['coach_art.png', 'coach.jpg'],
    ['pokemon4_art.png', 'pokemon4.jpg'],
    ['pokemon5_art.png', 'pokemon5.jpg'],
    ['pokemon6_art.png', 'pokemon6.jpg'],
    ['mimi_art.png', 'mimi.jpg'],
    ['schoolyard_bg_fixed.png', 'schoolyard_bg.jpg'],
];

async function main() {
    for (const [inFile, outFile] of files) {
        const img = await Jimp.read(path.join(SRC_DIR, inFile));
        const outPath = path.join(__dirname, '../assets', outFile);
        await img.quality(92).writeAsync(outPath);
        console.log('wrote', outFile, img.bitmap.width + 'x' + img.bitmap.height);
    }
}

main().catch(e => { console.error(e); process.exit(1); });
