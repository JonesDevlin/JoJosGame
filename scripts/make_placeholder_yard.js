// Generates PLACEHOLDER art for Level 2 (The Schoolyard) with jimp.
// Run: node scripts/make_placeholder_yard.js
//
// These are flat-shape stand-ins. The project owner replaces them with real
// AI art in the established pixel-art style:
//   assets/schoolyard_bg.jpg  <- AI-generated schoolyard scene, 1376x768
//                                (school wall + door top center, fence with a
//                                bottom-center gate at image x ~600-780,
//                                sandbox left-center, trees right side)
//   assets/coach.png          <- drop assets/coach.jpg, run scripts/remove_bg.js
//   assets/pokemon4.png       <- drop assets/pokemon4.jpg (electric type), remove_bg.js
//   assets/pokemon5.png       <- drop assets/pokemon5.jpg (psychic type), remove_bg.js
//   assets/pokemon6.png       <- drop assets/pokemon6.jpg (flying type), remove_bg.js
// After replacing, bump the ?v= query strings in SchoolyardScene.preload().

const Jimp = require('jimp');

// ---- tiny shape helpers (colors are 0xRRGGBBAA ints) ----

function fillRect(img, x0, y0, w, h, color) {
    const xMax = Math.min(img.bitmap.width, x0 + w);
    const yMax = Math.min(img.bitmap.height, y0 + h);
    for (let y = Math.max(0, y0); y < yMax; y++) {
        for (let x = Math.max(0, x0); x < xMax; x++) {
            img.setPixelColor(color, x, y);
        }
    }
}

function fillCircle(img, cx, cy, r, color) {
    const xMin = Math.max(0, Math.floor(cx - r));
    const xMax = Math.min(img.bitmap.width - 1, Math.ceil(cx + r));
    const yMin = Math.max(0, Math.floor(cy - r));
    const yMax = Math.min(img.bitmap.height - 1, Math.ceil(cy + r));
    for (let y = yMin; y <= yMax; y++) {
        for (let x = xMin; x <= xMax; x++) {
            const dx = x - cx, dy = y - cy;
            if (dx * dx + dy * dy <= r * r) img.setPixelColor(color, x, y);
        }
    }
}

function fillTriangle(img, p1, p2, p3, color) {
    const xMin = Math.max(0, Math.floor(Math.min(p1[0], p2[0], p3[0])));
    const xMax = Math.min(img.bitmap.width - 1, Math.ceil(Math.max(p1[0], p2[0], p3[0])));
    const yMin = Math.max(0, Math.floor(Math.min(p1[1], p2[1], p3[1])));
    const yMax = Math.min(img.bitmap.height - 1, Math.ceil(Math.max(p1[1], p2[1], p3[1])));
    const sign = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    for (let y = yMin; y <= yMax; y++) {
        for (let x = xMin; x <= xMax; x++) {
            const d1 = sign(p1, p2, [x, y]);
            const d2 = sign(p2, p3, [x, y]);
            const d3 = sign(p3, p1, [x, y]);
            const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
            const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
            if (!(hasNeg && hasPos)) img.setPixelColor(color, x, y);
        }
    }
}

// ---- background: 1376x768 schoolyard ----
// Canvas mapping (game shows it at 800x600): canvasX = imgX * 0.5814,
// canvasY = imgY * 0.78125. Keep the gate opening at image x 600-780 so it
// lines up with SCHOOLYARD_EXIT (canvas x 350-450).

function makeBackground() {
    const W = 1376, H = 768;
    const img = new Jimp(W, H, 0x5a9445ff); // grass base

    // Mowing stripes for a bit of texture
    for (let band = 0; band * 96 < H; band++) {
        if (band % 2 === 1) fillRect(img, 0, band * 96, W, 96, 0x549043ff);
    }

    // School wall band across the top (y 0-160), brick with a roof edge
    fillRect(img, 0, 0, W, 150, 0xb0765aff);
    for (let y = 20; y < 140; y += 30) { // faint brick lines
        fillRect(img, 0, y, W, 3, 0xa06a50ff);
    }
    fillRect(img, 0, 150, W, 12, 0x7a4a35ff); // wall base / shadow line

    // Door at top center (canvas x ~400): image x 616-760
    fillRect(img, 608, 20, 160, 142, 0x3e2a18ff);  // frame
    fillRect(img, 620, 32, 136, 130, 0x5b3a24ff);  // door
    fillRect(img, 682, 32, 12, 130, 0x3e2a18ff);   // double-door split
    fillCircle(img, 668, 100, 6, 0xe8d060ff);      // handles
    fillCircle(img, 708, 100, 6, 0xe8d060ff);

    // Dirt path from the door down to the gate
    fillRect(img, 645, 162, 90, H - 162, 0xd9c493ff);

    // Fence (wood) around left/right/bottom edges
    const fence = 0x8a6a45ff, fenceDark = 0x6e5236ff;
    fillRect(img, 0, 162, 40, H - 162, fence);        // left
    fillRect(img, W - 40, 162, 40, H - 162, fence);   // right
    fillRect(img, 0, H - 40, 600, 40, fence);         // bottom-left run
    fillRect(img, 780, H - 40, W - 780, 40, fence);   // bottom-right run
    // fence post texture
    for (let x = 0; x < 600; x += 48) fillRect(img, x, H - 40, 6, 40, fenceDark);
    for (let x = 780; x < W; x += 48) fillRect(img, x, H - 40, 6, 40, fenceDark);
    // gate posts flanking the opening (image x 600-780 stays open)
    fillRect(img, 585, H - 90, 18, 90, fenceDark);
    fillRect(img, 773, H - 90, 18, 90, fenceDark);

    // Sandbox left-center (image ~230-470 x 350-510)
    fillRect(img, 230, 350, 240, 160, 0xa08050ff);    // wooden border
    fillRect(img, 246, 366, 208, 128, 0xe8d8a0ff);    // sand
    fillCircle(img, 320, 430, 22, 0xd9c07eff);        // sand dimples
    fillCircle(img, 400, 455, 16, 0xd9c07eff);
    fillRect(img, 300, 388, 14, 60, 0xd64541ff);      // toy shovel
    fillRect(img, 288, 382, 38, 12, 0xd64541ff);

    // Trees on the right side (trunk + canopy blobs)
    const trees = [
        { x: 1150, y: 250, r: 90 },
        { x: 1230, y: 470, r: 80 },
        { x: 1080, y: 620, r: 75 }
    ];
    trees.forEach(t => {
        fillRect(img, t.x - 14, t.y, 28, t.r + 40, 0x6b4a2aff);       // trunk
        fillCircle(img, t.x, t.y, t.r + 8, 0x2e5c26ff);               // canopy outline
        fillCircle(img, t.x, t.y, t.r, 0x3e7a34ff);                   // canopy
        fillCircle(img, t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.45, 0x4c8f40ff); // highlight
    });

    return img.quality(90).writeAsync('assets/schoolyard_bg.jpg');
}

// ---- characters: 512x512 transparent PNGs ----

const OUTLINE = 0x263238ff;
const TRANSPARENT = 0x00000000;

function newCanvas() {
    return new Jimp(512, 512, TRANSPARENT);
}

// Coach: red-tracksuit figure with a cap and a whistle on a lanyard
function makeCoach() {
    const img = newCanvas();
    // outline silhouettes (expanded shapes in dark)
    fillCircle(img, 256, 130, 82, OUTLINE);
    fillRect(img, 158, 202, 196, 218, OUTLINE);
    fillRect(img, 178, 412, 66, 92, OUTLINE);
    fillRect(img, 268, 412, 66, 92, OUTLINE);
    // head + cap
    fillCircle(img, 256, 130, 72, 0xf0c8a0ff);
    fillRect(img, 176, 44, 160, 52, 0xd64541ff);        // cap crown
    fillRect(img, 156, 84, 200, 18, 0xb03530ff);        // cap brim
    fillCircle(img, 232, 140, 9, OUTLINE);              // eyes
    fillCircle(img, 280, 140, 9, OUTLINE);
    fillRect(img, 240, 168, 32, 6, OUTLINE);            // mouth
    // torso (tracksuit) + arms
    fillRect(img, 168, 212, 176, 200, 0xd64541ff);
    fillRect(img, 168, 212, 40, 160, 0xb03530ff);       // arm shading
    fillRect(img, 304, 212, 40, 160, 0xb03530ff);
    fillRect(img, 168, 300, 176, 14, 0xffffffff);       // jacket stripe
    // legs
    fillRect(img, 186, 420, 50, 76, 0x37474fff);
    fillRect(img, 276, 420, 50, 76, 0x37474fff);
    // whistle lanyard + whistle
    fillTriangle(img, [226, 212], [286, 212], [256, 320], 0xffd54fff);
    fillCircle(img, 256, 322, 26, OUTLINE);
    fillCircle(img, 256, 322, 20, 0x9e9e9eff);
    fillCircle(img, 256, 322, 7, 0x616161ff);
    return img.writeAsync('assets/coach.png');
}

// Pika-spark: yellow round electric critter, pointy ears, bolt on belly
function makePokemon4() {
    const img = newCanvas();
    fillTriangle(img, [150, 200], [210, 160], [96, 30], OUTLINE);   // ear outlines
    fillTriangle(img, [362, 200], [302, 160], [416, 30], OUTLINE);
    fillCircle(img, 256, 300, 168, OUTLINE);                        // body outline
    fillTriangle(img, [156, 190], [204, 168], [112, 52], 0xf7d02cff); // ears
    fillTriangle(img, [356, 190], [308, 168], [400, 52], 0xf7d02cff);
    fillTriangle(img, [118, 92], [146, 128], [112, 52], 0x263238ff);  // black ear tips
    fillTriangle(img, [394, 92], [366, 128], [400, 52], 0x263238ff);
    fillCircle(img, 256, 300, 158, 0xf7d02cff);                     // body
    fillCircle(img, 200, 250, 16, OUTLINE);                         // eyes
    fillCircle(img, 312, 250, 16, OUTLINE);
    fillCircle(img, 160, 310, 24, 0xe57373ff);                      // cheeks
    fillCircle(img, 352, 310, 24, 0xe57373ff);
    fillTriangle(img, [268, 330], [220, 400], [258, 392], 0xef8a2bff); // lightning bolt
    fillTriangle(img, [258, 380], [296, 372], [244, 452], 0xef8a2bff);
    return img.writeAsync('assets/pokemon4.png');
}

// Psy-duckling: purple/psychic round critter with a forehead gem
function makePokemon5() {
    const img = newCanvas();
    fillCircle(img, 256, 168, 108, OUTLINE);            // head outline
    fillCircle(img, 256, 350, 148, OUTLINE);            // body outline
    fillCircle(img, 256, 350, 138, 0x9b59b6ff);         // body
    fillCircle(img, 256, 168, 98, 0xa66bc4ff);          // head
    fillCircle(img, 256, 110, 22, 0x6c3483ff);          // psychic gem
    fillCircle(img, 256, 110, 10, 0xd7a8f0ff);
    fillCircle(img, 220, 170, 14, OUTLINE);             // eyes
    fillCircle(img, 292, 170, 14, OUTLINE);
    fillRect(img, 232, 208, 48, 14, 0xefc94cff);        // little duck bill
    fillCircle(img, 176, 360, 34, 0x8449a3ff);          // stubby wings
    fillCircle(img, 336, 360, 34, 0x8449a3ff);
    return img.writeAsync('assets/pokemon5.png');
}

// Flutter-bird: sky-blue bird with a wing and an orange beak
function makePokemon6() {
    const img = newCanvas();
    fillCircle(img, 280, 300, 158, OUTLINE);            // body outline
    fillCircle(img, 280, 300, 148, 0x6ec6f0ff);         // body
    fillCircle(img, 300, 180, 92, OUTLINE);             // head outline
    fillCircle(img, 300, 180, 84, 0x82d2f5ff);          // head
    fillTriangle(img, [376, 168], [376, 208], [446, 188], 0xef8a2bff); // beak
    fillCircle(img, 330, 168, 13, OUTLINE);             // eye
    fillCircle(img, 208, 300, 78, 0x4aa8dcff);          // wing
    fillTriangle(img, [150, 380], [110, 470], [200, 420], 0x4aa8dcff); // tail feather
    fillTriangle(img, [246, 440], [236, 500], [276, 452], 0xef8a2bff); // feet
    fillTriangle(img, [306, 440], [316, 500], [276, 452], 0xef8a2bff);
    return img.writeAsync('assets/pokemon6.png');
}

async function main() {
    await makeBackground();
    await makeCoach();
    await makePokemon4();
    await makePokemon5();
    await makePokemon6();
    console.log('Placeholder yard art written to assets/.');
}

main().catch(err => { console.error(err); process.exit(1); });
