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
//   assets/pokemon4.png       <- drop assets/pokemon4.jpg (small ruby dragon), remove_bg.js
//   assets/pokemon5.png       <- drop assets/pokemon5.jpg (round ruby dragon), remove_bg.js
//   assets/pokemon6.png       <- drop assets/pokemon6.jpg (winged ruby dragon), remove_bg.js
//   assets/mimi.png           <- drop assets/mimi.jpg (ghost in a patched cloth
//                                costume riding a little red bicycle, side view),
//                                run remove_bg.js
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

// Ruby dragon palette
const RUBY = 0xc62828ff;        // main scales
const RUBY_DARK = 0x8e1b1bff;   // wings / shading
const RUBY_LIGHT = 0xe57373ff;  // highlights
const BELLY = 0xf5c6a0ff;       // belly plates
const HORN = 0xf5e6c8ff;        // horns / spikes

// Ruby-spark: small ruby dragon hatchling — horns, stubby wings, zigzag tail
function makePokemon4() {
    const img = newCanvas();
    // outlines
    fillTriangle(img, [176, 130], [232, 168], [166, 40], OUTLINE);  // horn outlines
    fillTriangle(img, [336, 130], [280, 168], [346, 40], OUTLINE);
    fillCircle(img, 256, 300, 168, OUTLINE);                        // body outline
    fillTriangle(img, [96, 250], [176, 220], [150, 330], OUTLINE);  // left wing outline
    fillTriangle(img, [416, 250], [336, 220], [362, 330], OUTLINE); // right wing outline
    // horns
    fillTriangle(img, [184, 134], [226, 162], [174, 52], HORN);
    fillTriangle(img, [328, 134], [286, 162], [338, 52], HORN);
    // stubby wings
    fillTriangle(img, [108, 252], [176, 226], [154, 322], RUBY_DARK);
    fillTriangle(img, [404, 252], [336, 226], [358, 322], RUBY_DARK);
    // body + belly
    fillCircle(img, 256, 300, 158, RUBY);
    fillCircle(img, 256, 360, 96, BELLY);
    // eyes + snout
    fillCircle(img, 205, 245, 16, OUTLINE);
    fillCircle(img, 307, 245, 16, OUTLINE);
    fillCircle(img, 209, 240, 5, 0xffffffff);
    fillCircle(img, 311, 240, 5, 0xffffffff);
    fillCircle(img, 236, 292, 7, OUTLINE);                          // nostrils
    fillCircle(img, 276, 292, 7, OUTLINE);
    // zigzag spark tail
    fillTriangle(img, [366, 400], [420, 372], [430, 430], RUBY);
    fillTriangle(img, [430, 430], [478, 408], [462, 462], RUBY_LIGHT);
    return img.writeAsync('assets/pokemon4.png');
}

// Ruby-scale: round chunky ruby dragon with a gem belly and back spikes
function makePokemon5() {
    const img = newCanvas();
    // back spikes
    fillTriangle(img, [166, 170], [226, 190], [176, 90], OUTLINE);
    fillTriangle(img, [346, 170], [286, 190], [336, 90], OUTLINE);
    fillTriangle(img, [256, 150], [216, 180], [256, 60], OUTLINE);
    fillTriangle(img, [174, 168], [222, 186], [184, 102], HORN);
    fillTriangle(img, [338, 168], [290, 186], [328, 102], HORN);
    fillTriangle(img, [256, 146], [224, 176], [256, 74], HORN);
    // body
    fillCircle(img, 256, 320, 160, OUTLINE);
    fillCircle(img, 256, 320, 150, RUBY);
    // ruby gem on the belly
    fillCircle(img, 256, 372, 88, BELLY);
    fillTriangle(img, [256, 320], [216, 372], [296, 372], 0x9b111eff);
    fillTriangle(img, [216, 372], [296, 372], [256, 428], 0xd63a3aff);
    // face
    fillCircle(img, 208, 268, 15, OUTLINE);
    fillCircle(img, 304, 268, 15, OUTLINE);
    fillCircle(img, 212, 263, 5, 0xffffffff);
    fillCircle(img, 308, 263, 5, 0xffffffff);
    fillRect(img, 236, 302, 40, 8, OUTLINE);                        // smile
    // little arms
    fillCircle(img, 130, 350, 34, RUBY_DARK);
    fillCircle(img, 382, 350, 34, RUBY_DARK);
    return img.writeAsync('assets/pokemon5.png');
}

// Ruby-wing: ruby dragon with big spread wings and a flame tail tip
function makePokemon6() {
    const img = newCanvas();
    // big wing membranes
    fillTriangle(img, [60, 110], [230, 240], [110, 330], OUTLINE);
    fillTriangle(img, [452, 110], [282, 240], [402, 330], OUTLINE);
    fillTriangle(img, [76, 124], [224, 240], [120, 316], RUBY_DARK);
    fillTriangle(img, [436, 124], [288, 240], [392, 316], RUBY_DARK);
    fillTriangle(img, [110, 170], [200, 244], [130, 290], RUBY_LIGHT);
    fillTriangle(img, [402, 170], [312, 244], [382, 290], RUBY_LIGHT);
    // body + head
    fillCircle(img, 256, 330, 138, OUTLINE);
    fillCircle(img, 256, 330, 128, RUBY);
    fillCircle(img, 256, 196, 96, OUTLINE);
    fillCircle(img, 256, 196, 88, RUBY);
    fillCircle(img, 256, 370, 76, BELLY);
    // horns + eyes + snout
    fillTriangle(img, [206, 130], [238, 152], [190, 70], HORN);
    fillTriangle(img, [306, 130], [274, 152], [322, 70], HORN);
    fillCircle(img, 222, 192, 14, OUTLINE);
    fillCircle(img, 290, 192, 14, OUTLINE);
    fillCircle(img, 226, 187, 5, 0xffffffff);
    fillCircle(img, 294, 187, 5, 0xffffffff);
    fillCircle(img, 240, 232, 6, OUTLINE);
    fillCircle(img, 272, 232, 6, OUTLINE);
    // tail with flame tip
    fillTriangle(img, [340, 420], [408, 452], [360, 486], RUBY);
    fillCircle(img, 416, 458, 26, 0xef8a2bff);                      // flame
    fillCircle(img, 416, 458, 13, 0xffd54fff);
    return img.writeAsync('assets/pokemon6.png');
}

// Mimi-Q: ghost in a lumpy patched cloth costume riding a red bicycle (side view)
function makeMimi() {
    const img = newCanvas();
    const CLOTH = 0xe8d8b0ff;
    const CLOTH_DARK = 0xcdb98cff;
    const BIKE = 0xd63a3aff;

    // bicycle wheels
    fillCircle(img, 150, 400, 74, OUTLINE);
    fillCircle(img, 150, 400, 62, 0x455a64ff);
    fillCircle(img, 150, 400, 18, 0x90a4aeff);
    fillCircle(img, 380, 400, 74, OUTLINE);
    fillCircle(img, 380, 400, 62, 0x455a64ff);
    fillCircle(img, 380, 400, 18, 0x90a4aeff);
    // frame: back wheel -> seat, seat -> pedals -> front wheel, handlebar post
    fillTriangle(img, [150, 400], [252, 296], [268, 316], BIKE);
    fillTriangle(img, [252, 296], [380, 400], [268, 316], BIKE);
    fillRect(img, 366, 250, 18, 150, BIKE);            // handlebar post
    fillRect(img, 330, 240, 90, 16, OUTLINE);          // handlebar
    fillRect(img, 236, 284, 60, 16, OUTLINE);          // saddle
    fillCircle(img, 262, 402, 14, OUTLINE);            // pedal crank
    // costume body sitting on the saddle
    fillCircle(img, 250, 200, 108, OUTLINE);           // body outline
    fillCircle(img, 250, 200, 98, CLOTH);              // lumpy cloth body
    fillCircle(img, 250, 116, 62, OUTLINE);            // head lump outline
    fillCircle(img, 250, 116, 54, CLOTH);
    // floppy crooked ears
    fillTriangle(img, [206, 78], [232, 96], [166, 22], OUTLINE);
    fillTriangle(img, [212, 80], [230, 94], [178, 36], CLOTH_DARK);
    fillTriangle(img, [292, 76], [268, 96], [318, 10], OUTLINE);
    fillTriangle(img, [288, 80], [270, 94], [308, 26], CLOTH_DARK);
    // hand-drawn scribble face (crooked eyes + wobbly smile)
    fillCircle(img, 226, 112, 9, OUTLINE);
    fillCircle(img, 272, 108, 9, OUTLINE);
    fillRect(img, 222, 140, 34, 6, OUTLINE);           // crooked smile
    fillRect(img, 252, 144, 26, 6, OUTLINE);
    // patch on the costume
    fillRect(img, 286, 224, 34, 28, CLOTH_DARK);
    fillRect(img, 286, 236, 34, 4, 0xa08a60ff);
    // stubby arm reaching the handlebar
    fillRect(img, 300, 216, 76, 20, CLOTH);
    return img.writeAsync('assets/mimi.png');
}

async function main() {
    await makeBackground();
    await makeCoach();
    await makePokemon4();
    await makePokemon5();
    await makePokemon6();
    await makeMimi();
    console.log('Placeholder yard art written to assets/.');
}

main().catch(err => { console.error(err); process.exit(1); });
