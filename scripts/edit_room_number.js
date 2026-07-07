// One-off asset patch: changes the wall plaque in classroom_bg.jpg from
// "ROOM 101" to "ROOM 123". The leading "1" glyph is untouched; the "0" and
// trailing "1" are erased (refilled with plate color sampled from the gap
// between "ROOM" and the number) and replaced with hand-drawn pixel digits.
const Jimp = require('jimp');
const path = require('path');

const BG_PATH = path.join(__dirname, '../assets/classroom_bg.jpg');

// 13-row glyphs matching the plaque font metrics (digits ~9px wide, 13px tall)
const GLYPH_2 = [
    '.#######.',
    '##.....##',
    '##.....##',
    '.......##',
    '.......##',
    '......##.',
    '.....##..',
    '....##...',
    '...##....',
    '..##.....',
    '.##......',
    '##.......',
    '#########'
];
const GLYPH_3 = [
    '.#######.',
    '##.....##',
    '.......##',
    '.......##',
    '......##.',
    '...####..',
    '......##.',
    '.......##',
    '.......##',
    '.......##',
    '##.....##',
    '##.....##',
    '.#######.'
];

function drawGlyph(img, glyph, left, top, color) {
    for (let row = 0; row < glyph.length; row++) {
        for (let col = 0; col < glyph[row].length; col++) {
            if (glyph[row][col] === '#') {
                img.setPixelColor(color, left + col, top + row);
            }
        }
    }
}

(async () => {
    const img = await Jimp.read(BG_PATH);

    // Sample the text ink color from the darkest pixel of the old "0" glyph
    let ink = 0, darkest = 255;
    for (let y = 36; y <= 49; y++) {
        for (let x = 814; x <= 824; x++) {
            const c = Jimp.intToRGBA(img.getPixelColor(x, y));
            const lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
            if (lum < darkest) { darkest = lum; ink = img.getPixelColor(x, y); }
        }
    }

    // Erase "01": refill each row from the clean plate gap at x=800 so the
    // plate's vertical shading gradient is preserved
    for (let y = 33; y <= 52; y++) {
        const plate = img.getPixelColor(800, y);
        for (let x = 812; x <= 834; x++) {
            img.setPixelColor(plate, x, y);
        }
    }

    // Draw "2" and "3" where "0" and "1" used to be (text baseline y 36-48)
    drawGlyph(img, GLYPH_2, 814, 36, ink);
    drawGlyph(img, GLYPH_3, 826, 36, ink);

    await img.quality(95).writeAsync(BG_PATH);
    console.log('Plaque updated: ROOM 101 -> ROOM 123');
})();
