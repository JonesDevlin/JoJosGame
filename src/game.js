// Shared state bound to whichever scene is active (dialogue/puzzle overlay
// functions and console testing rely on these staying module-scope globals)
let activeScene = null;
let player;
let cursors;
let pokemons = [];
let puzzleActive = false;
let dialogueActive = false;
let currentPokemon = null;
let lastInteract = 0;

const CLASSROOM_TOTAL = 3;
const CLASSROOM_EXIT = { y: 535, minX: 350, maxX: 450 };
const SCHOOLYARD_EXIT = { y: 530, minX: 350, maxX: 450 };

// ---- Shared scene helpers ----

function createPlayer(scene, x, y) {
    const p = scene.physics.add.sprite(x, y, 'player');
    p.setDisplaySize(92, 92);
    // Collision box covers only the feet (in source-texture pixels, relative
    // to frame size) so the player can walk between obstacles top-down style
    p.body.setSize(p.width * 0.42, p.height * 0.2)
        .setOffset(p.width * 0.29, p.height * 0.76);
    p.setCollideWorldBounds(true);
    return p;
}

function createNpc(scene, x, y, key, size, shadowOffsetY, shadowW, shadowH) {
    // Ground shadow so the character looks planted on the floor
    scene.add.ellipse(x, y + shadowOffsetY, shadowW, shadowH, 0x000000, 0.22);
    const npc = scene.physics.add.staticSprite(x, y, key);
    npc.setDisplaySize(size, size);
    npc.refreshBody(); // static bodies don't follow setDisplaySize on their own
    return npc;
}

// Bobbing "!" hint shown over whichever character is close enough to interact
function createInteractHint(scene) {
    return scene.add.text(0, 0, '!', {
        fontFamily: 'Courier New',
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#ffeb3b',
        stroke: '#000000',
        strokeThickness: 5
    }).setOrigin(0.5, 1).setVisible(false);
}

function updateInteractHint(hint, target, time) {
    if (target) {
        hint.setVisible(true);
        hint.setPosition(
            target.x,
            target.y - target.displayHeight / 2 - 6 + Math.sin(time / 180) * 4
        );
    } else {
        hint.setVisible(false);
    }
}

function inExitZone(sprite, zone) {
    return sprite.y > zone.y && sprite.x > zone.minX && sprite.x < zone.maxX;
}

// Space closes an open dialogue; returns true while an overlay blocks gameplay
function overlayBlocking(scene) {
    if (dialogueActive && Phaser.Input.Keyboard.JustDown(scene.interactKey)) {
        hideDialogue();
        return true; // Prevent triggering interactions in the same frame
    }
    if (puzzleActive || dialogueActive) {
        scene.player.setVelocity(0);
        scene.interactHint.setVisible(false);
        return true;
    }
    return false;
}

function updatePlayerMovement(scene) {
    const speed = 200;
    scene.player.setVelocity(0);

    if (scene.cursors.left.isDown) {
        scene.player.setVelocityX(-speed);
    } else if (scene.cursors.right.isDown) {
        scene.player.setVelocityX(speed);
    }

    if (scene.cursors.up.isDown) {
        scene.player.setVelocityY(-speed);
    } else if (scene.cursors.down.isDown) {
        scene.player.setVelocityY(speed);
    }
}

// Point the module-scope globals at the scene that just started so the
// overlay functions (and console tests) keep working across scenes
function bindSceneGlobals(scene) {
    activeScene = scene;
    player = scene.player;
    cursors = scene.cursors;
    pokemons = scene.pokemons;
    window.activeScene = scene;
}

// ---- Scenes ----

class ClassroomScene extends Phaser.Scene {
    constructor() {
        super('ClassroomScene');
    }

    preload() {
        this.load.image('bg', 'assets/classroom_bg.jpg?v=4');
        this.load.image('player', 'assets/player.png?v=5');
        this.load.image('teacher', 'assets/teacher.png?v=5');
        this.load.image('pokemon1', 'assets/pokemon1.png?v=5');
        this.load.image('pokemon2', 'assets/pokemon2.png?v=5');
        this.load.image('pokemon3', 'assets/pokemon3.png?v=5');
    }

    create() {
        // Cross-level progress lives in the game registry
        this.registry.set('hasPokedex', false);
        this.registry.set('caughtCount', 0);

        // Add background and scale to fit
        let bg = this.add.image(400, 300, 'bg');
        bg.setDisplaySize(800, 600);

        // Create Teacher (standing at the front of the class, below the blackboard)
        this.teacher = createNpc(this, 400, 234, 'teacher', 100, 46, 62, 20);

        // Create Pokemons
        const p1 = createNpc(this, 200, 400, 'pokemon1', 64, 28, 48, 16);
        const p2 = createNpc(this, 600, 400, 'pokemon2', 64, 28, 48, 16);
        const p3 = createNpc(this, 400, 500, 'pokemon3', 64, 28, 48, 16);
        p1.name = 'Bulba-plant';
        p2.name = 'Char-lizard';
        p3.name = 'Squirt-turtle';
        p1.puzzleType = 'sequence';
        p2.puzzleType = 'timing';
        p3.puzzleType = 'match';
        this.pokemons = [p1, p2, p3];
        this.pokemons.forEach(p => {
            p.caught = false;
        });

        // Create Player (spawns on the open floor at the bottom of the room)
        this.playerShadow = this.add.ellipse(400, 592, 52, 17, 0x000000, 0.22);
        this.player = createPlayer(this, 400, 515);

        // Keep the player on the classroom floor (inside the walls)
        this.physics.world.setBounds(50, 225, 700, 360);

        // Invisible static colliders for the student desks (5 columns x 3 rows)
        // and the teacher's desk, matching the furniture baked into the background
        const obstacles = this.physics.add.staticGroup();
        const deskCols = [141, 273, 399, 526, 654];
        const deskRows = [301, 395, 500];
        deskCols.forEach(x => deskRows.forEach(y => {
            const desk = this.add.rectangle(x, y, 76, 48);
            this.physics.add.existing(desk, true);
            obstacles.add(desk);
        }));
        const teacherDesk = this.add.rectangle(161, 150, 130, 60);
        this.physics.add.existing(teacherDesk, true);
        obstacles.add(teacherDesk);
        this.physics.add.collider(this.player, obstacles);

        this.interactHint = createInteractHint(this);

        // Collisions (Solid barriers)
        this.physics.add.collider(this.player, this.teacher);
        this.pokemons.forEach(p => {
            this.physics.add.collider(this.player, p);
        });

        // Input
        this.cursors = this.input.keyboard.createCursorKeys();
        this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        this.exiting = false;
        bindSceneGlobals(this);
    }

    update(time) {
        this.playerShadow.setPosition(this.player.x, this.player.y + 42);

        if (this.exiting) {
            this.player.setVelocity(0);
            return;
        }

        // Door exit: the Pikachu rug at the bottom is the welcome mat for the
        // (off-screen) classroom door
        if (inExitZone(this.player, CLASSROOM_EXIT)) {
            if (this.registry.get('caughtCount') >= CLASSROOM_TOTAL) {
                this.exiting = true;
                this.player.setVelocity(0);
                this.interactHint.setVisible(false);
                this.cameras.main.fadeOut(900, 0, 0, 0);
                this.cameras.main.once('camerafadeoutcomplete', () => {
                    this.scene.start('SchoolyardScene');
                });
                return;
            } else if (!dialogueActive && !puzzleActive) {
                this.player.setPosition(this.player.x, 520); // step back off the mat
                showDialogue(this.registry.get('hasPokedex')
                    ? "Professor: Not so fast! " + (CLASSROOM_TOTAL - this.registry.get('caughtCount')) + " Pokemon still need cheering up."
                    : "Professor: Class is in session! Come get your Pokedex first.");
            }
        }

        if (overlayBlocking(this)) return;

        let hintTarget = null;
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.teacher.x, this.teacher.y) < 80) {
            hintTarget = this.teacher;
        }
        this.pokemons.forEach(p => {
            if (!p.caught && Phaser.Math.Distance.Between(this.player.x, this.player.y, p.x, p.y) < 80) {
                hintTarget = p;
            }
        });
        updateInteractHint(this.interactHint, hintTarget, time);

        updatePlayerMovement(this);

        // Interaction with Spacebar
        if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
            if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.teacher.x, this.teacher.y) < 80) {
                interactTeacher();
            } else {
                this.pokemons.forEach(p => {
                    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, p.x, p.y) < 80) {
                        interactPokemon(p);
                    }
                });
            }
        }
    }
}

// Level 2 shell: placeholder background and a temporary exit until the real
// schoolyard content (Coach + 3 Pokemon) lands
class SchoolyardScene extends Phaser.Scene {
    constructor() {
        super('SchoolyardScene');
    }

    create() {
        // Placeholder grass until assets/schoolyard_bg.jpg exists
        this.add.rectangle(400, 300, 800, 600, 0x5a9445);

        // Player fades in at the top center, just below the school door
        this.playerShadow = this.add.ellipse(400, 162, 52, 17, 0x000000, 0.22);
        this.player = createPlayer(this, 400, 120);
        this.physics.world.setBounds(50, 80, 700, 500);

        this.pokemons = [];
        this.interactHint = createInteractHint(this);

        this.cursors = this.input.keyboard.createCursorKeys();
        this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        this.exiting = false;
        this.cameras.main.fadeIn(900, 0, 0, 0);
        bindSceneGlobals(this);
    }

    update(time) {
        this.playerShadow.setPosition(this.player.x, this.player.y + 42);

        if (this.exiting) {
            this.player.setVelocity(0);
            return;
        }

        // Temporary exit: the school gate at the bottom ends the game
        // unconditionally until Level 2 progression is wired up
        if (inExitZone(this.player, SCHOOLYARD_EXIT)) {
            this.exiting = true;
            this.player.setVelocity(0);
            this.interactHint.setVisible(false);
            this.cameras.main.fadeOut(900, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                document.getElementById('ending-ui').classList.remove('hidden');
            });
            return;
        }

        if (overlayBlocking(this)) return;

        updateInteractHint(this.interactHint, null, time);
        updatePlayerMovement(this);
    }
}

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    pixelArt: true,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [ClassroomScene, SchoolyardScene]
};

const game = new Phaser.Game(config);
window.game = game;

// Setup UI buttons
document.getElementById('puzzle-close').addEventListener('click', () => {
    hidePuzzle();
});
document.getElementById('dialogue-close').addEventListener('click', () => {
    hideDialogue();
});

// ---- Level chrome: title cards + Pokedex HUD (global, outside the scenes) ----

const LEVEL_TITLES = {
    ClassroomScene: 'Room 123',
    SchoolyardScene: 'Level 2: The Schoolyard'
};

let levelTitleTimer = null;

// Briefly shows the level name near the top of the screen. The overlay is
// pointer-events: none, so it never blocks input or dialogue.
function showLevelTitle(sceneKey) {
    const el = document.getElementById('level-title');
    el.innerText = LEVEL_TITLES[sceneKey] || sceneKey;
    clearTimeout(levelTitleTimer);
    el.classList.remove('show');
    void el.offsetWidth; // force reflow so the fade restarts on scene changes
    el.classList.add('show');
    levelTitleTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

function updatePokedexHud(count) {
    document.getElementById('pokedex-hud').innerText = 'Pokedex: ' + (count || 0) + '/6';
}

// Hook every scene's create event once the game has booted. The SceneManager
// also boots on READY (its listener runs first), but scene create waits for
// the async preload, so these hooks attach in time for the first create.
game.events.once(Phaser.Core.Events.READY, () => {
    game.scene.scenes.forEach(s => {
        s.sys.events.on(Phaser.Scenes.Events.CREATE, () => showLevelTitle(s.scene.key));
    });
    updatePokedexHud(game.registry.get('caughtCount'));
});

// Keep the HUD in sync with cross-level progress in the registry
game.registry.events.on('changedata-caughtCount', (parent, value) => {
    updatePokedexHud(value);
});

// ---- Interactions ----

function interactTeacher() {
    if (dialogueActive || puzzleActive) return;

    let now = Date.now();
    if (now - lastInteract < 1000) return;

    const caughtCount = game.registry.get('caughtCount');
    if (!game.registry.get('hasPokedex')) {
        game.registry.set('hasPokedex', true);
        showDialogue("Professor: Welcome to the Academy! Here is your Pokedex. Go make 3 Pokemon happy!");
    } else if (caughtCount < CLASSROOM_TOTAL) {
        showDialogue("Professor: You still have " + (CLASSROOM_TOTAL - caughtCount) + " Pokemon to catch.");
    } else {
        showDialogue("Professor: Amazing! You completed the Pokedex! You pass! Head out the door - the Pikachu rug marks the way.");
    }
}

function interactPokemon(pokemon) {
    if (dialogueActive || puzzleActive) return;

    let now = Date.now();
    if (now - lastInteract < 1000) return;

    if (!game.registry.get('hasPokedex')) {
        showDialogue("You need a Pokedex from the Professor first!");
        return;
    }

    if (pokemon.caught) return;

    showPuzzle(pokemon);
}

// ---- Dialogue / puzzle HTML overlays (global on purpose: the setup*Puzzle
// contract is shared with in-flight work, do not move these onto scenes) ----

function showDialogue(text) {
    dialogueActive = true;
    const ui = document.getElementById('dialogue-ui');
    const textElement = document.getElementById('dialogue-text');
    ui.classList.remove('hidden');
    textElement.innerText = text;

    if(player) {
        player.setVelocity(0, 0);
        // Clear keyboard inputs to prevent drifting
        cursors.left.reset();
        cursors.right.reset();
        cursors.up.reset();
        cursors.down.reset();
    }
}

function hideDialogue() {
    dialogueActive = false;
    lastInteract = Date.now(); // reset cooldown WHEN they close it
    document.getElementById('dialogue-ui').classList.add('hidden');
}

// Set by each puzzle so hidePuzzle can stop its timers/animation loops
let puzzleCleanup = null;

function showPuzzle(pokemon) {
    puzzleActive = true;
    currentPokemon = pokemon;

    const ui = document.getElementById('puzzle-ui');
    const title = document.getElementById('puzzle-text');
    const options = document.getElementById('puzzle-options');

    ui.classList.remove('hidden');
    options.innerHTML = '';

    if (pokemon.puzzleType === 'sequence') {
        setupSequencePuzzle(title, options, pokemon);
    } else if (pokemon.puzzleType === 'timing') {
        setupTimingPuzzle(title, options, pokemon);
    } else if (pokemon.puzzleType === 'circuit') {
        setupCircuitPuzzle(title, options, pokemon);
    } else if (pokemon.puzzleType === 'slider') {
        setupSliderPuzzle(title, options, pokemon);
    } else if (pokemon.puzzleType === 'catch') {
        setupCatchPuzzle(title, options, pokemon);
    } else {
        setupMatchPuzzle(title, options, pokemon);
    }
}

// Puzzle 1 (Bulba-plant): watch a sequence of flashing petals, then repeat it
function setupSequencePuzzle(title, options, pokemon) {
    title.innerText = `${pokemon.name} hums a melody! Watch the petals, then repeat the tune.`;

    const colors = ['#e53935', '#fdd835', '#43a047', '#1e88e5'];
    const sequence = [];
    for (let i = 0; i < 4; i++) {
        sequence.push(Math.floor(Math.random() * 4));
    }

    const status = document.createElement('p');
    status.className = 'puzzle-status';
    status.innerText = 'Watch closely...';
    options.appendChild(status);

    const grid = document.createElement('div');
    grid.className = 'sequence-grid';
    options.appendChild(grid);

    let playerIndex = 0;
    let accepting = false;
    const pads = colors.map((color, i) => {
        const pad = document.createElement('button');
        pad.className = 'sequence-pad';
        pad.style.backgroundColor = color;
        pad.onclick = () => {
            if (!accepting) return;
            flashPad(pad);
            if (i === sequence[playerIndex]) {
                playerIndex++;
                if (playerIndex === sequence.length) {
                    accepting = false;
                    setTimeout(() => solvePuzzle(true), 400);
                }
            } else {
                accepting = false;
                setTimeout(() => solvePuzzle(false), 400);
            }
        };
        grid.appendChild(pad);
        return pad;
    });

    function flashPad(pad) {
        pad.classList.add('lit');
        setTimeout(() => pad.classList.remove('lit'), 300);
    }

    // Play the sequence back, then hand control to the player
    const timers = [];
    sequence.forEach((padIndex, i) => {
        timers.push(setTimeout(() => flashPad(pads[padIndex]), 600 + i * 550));
    });
    timers.push(setTimeout(() => {
        status.innerText = 'Your turn! Repeat the melody.';
        accepting = true;
    }, 600 + sequence.length * 550));

    puzzleCleanup = () => timers.forEach(t => clearTimeout(t));
}

// Puzzle 2 (Char-lizard): stop the sweeping spark inside the hot zone
function setupTimingPuzzle(title, options, pokemon) {
    title.innerText = `${pokemon.name}'s flame is flickering! Catch the spark in the hot zone to warm it up.`;

    const status = document.createElement('p');
    status.className = 'puzzle-status';
    status.innerText = 'Tries left: 3';
    options.appendChild(status);

    const bar = document.createElement('div');
    bar.className = 'timing-bar';
    const zone = document.createElement('div');
    zone.className = 'timing-zone';
    const marker = document.createElement('div');
    marker.className = 'timing-marker';
    bar.appendChild(zone);
    bar.appendChild(marker);
    options.appendChild(bar);

    // Hot zone: 20% wide, at a random spot away from the edges
    const zoneStart = 15 + Math.random() * 50;
    const zoneWidth = 20;
    zone.style.left = zoneStart + '%';
    zone.style.width = zoneWidth + '%';

    let tries = 3;
    let running = true;
    let position = 0;
    const speed = 1.4; // percent per frame at 60fps

    let rafId = null;
    let direction = 1;
    function sweep() {
        position += speed * direction;
        if (position >= 100) { position = 100; direction = -1; }
        if (position <= 0) { position = 0; direction = 1; }
        marker.style.left = position + '%';
        if (running) rafId = requestAnimationFrame(sweep);
    }
    rafId = requestAnimationFrame(sweep);

    const catchBtn = document.createElement('button');
    catchBtn.className = 'puzzle-btn';
    catchBtn.innerText = 'Catch the spark!';
    catchBtn.onclick = () => {
        if (!running) return;
        if (position >= zoneStart && position <= zoneStart + zoneWidth) {
            running = false;
            marker.classList.add('hit');
            setTimeout(() => solvePuzzle(true), 400);
        } else {
            tries--;
            if (tries <= 0) {
                running = false;
                solvePuzzle(false);
            } else {
                status.innerText = 'Missed! Tries left: ' + tries;
            }
        }
    };
    options.appendChild(catchBtn);

    puzzleCleanup = () => {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
    };
}

// Puzzle 3 (Squirt-turtle): flip cards to find all 4 matching pairs
function setupMatchPuzzle(title, options, pokemon) {
    title.innerText = `${pokemon.name} wants to play! Find all the matching pairs.`;

    const symbols = ['\u{1F4A7}', '\u{1F41A}', '⭐', '\u{1F41F}']; // 💧 🐚 ⭐ 🐟
    const deck = [...symbols, ...symbols];
    deck.sort(() => Math.random() - 0.5);

    const grid = document.createElement('div');
    grid.className = 'match-grid';
    options.appendChild(grid);

    let flipped = [];
    let matchedCount = 0;
    let locked = false;
    let mismatchTimer = null;

    deck.forEach(symbol => {
        const card = document.createElement('button');
        card.className = 'match-card';
        card.innerText = '?';
        card.onclick = () => {
            if (locked || card.classList.contains('revealed')) return;
            card.classList.add('revealed');
            card.innerText = symbol;
            flipped.push({ card, symbol });

            if (flipped.length === 2) {
                if (flipped[0].symbol === flipped[1].symbol) {
                    flipped.forEach(f => f.card.classList.add('matched'));
                    flipped = [];
                    matchedCount++;
                    if (matchedCount === symbols.length) {
                        setTimeout(() => solvePuzzle(true), 500);
                    }
                } else {
                    locked = true;
                    const pair = flipped;
                    flipped = [];
                    mismatchTimer = setTimeout(() => {
                        pair.forEach(f => {
                            f.card.classList.remove('revealed');
                            f.card.innerText = '?';
                        });
                        locked = false;
                    }, 800);
                }
            }
        };
        grid.appendChild(card);
    });

    puzzleCleanup = () => clearTimeout(mismatchTimer);
}

// Puzzle 4 (Pika-spark): watch a 5-node path light up on the grid, then retrace it
function setupCircuitPuzzle(title, options, pokemon) {
    title.innerText = `${pokemon.name}'s power is out! Watch the circuit light up, then reconnect it in order.`;

    const path = [];
    for (let i = 0; i < 5; i++) {
        let node = Math.floor(Math.random() * 9);
        while (node === path[path.length - 1]) {
            node = Math.floor(Math.random() * 9);
        }
        path.push(node);
    }

    const status = document.createElement('p');
    status.className = 'puzzle-status';
    status.innerText = 'Watch closely...';
    options.appendChild(status);

    const grid = document.createElement('div');
    grid.className = 'circuit-grid';
    options.appendChild(grid);

    const timers = [];
    let playerIndex = 0;
    let accepting = false;

    function flashNode(node) {
        node.classList.add('lit');
        timers.push(setTimeout(() => node.classList.remove('lit'), 350));
    }

    const nodes = [];
    for (let i = 0; i < 9; i++) {
        const node = document.createElement('button');
        node.className = 'circuit-node';
        node.onclick = () => {
            if (!accepting) return;
            flashNode(node);
            if (i === path[playerIndex]) {
                playerIndex++;
                if (playerIndex === path.length) {
                    accepting = false;
                    timers.push(setTimeout(() => solvePuzzle(true), 400));
                }
            } else {
                accepting = false;
                timers.push(setTimeout(() => solvePuzzle(false), 400));
            }
        };
        grid.appendChild(node);
        nodes.push(node);
    }

    // Play the path back one node at a time, then hand control to the player
    path.forEach((nodeIndex, i) => {
        timers.push(setTimeout(() => flashNode(nodes[nodeIndex]), 600 + i * 550));
    });
    timers.push(setTimeout(() => {
        status.innerText = 'Your turn! Reconnect the circuit.';
        accepting = true;
    }, 600 + path.length * 550));

    puzzleCleanup = () => timers.forEach(t => clearTimeout(t));
}

// Puzzle 5 (Psy-duckling): slide tiles to restore the Pokemon's scrambled portrait
function setupSliderPuzzle(title, options, pokemon) {
    title.innerText = `${pokemon.name} scrambled its own picture! Slide the tiles to fix it.`;

    const size = 3;
    const tileSize = 64;
    const tileCount = size * size;
    const empty = tileCount - 1;
    const imageUrl = (pokemon.texture && pokemon.texture.key)
        ? `assets/${pokemon.texture.key}.png`
        : null;

    // board[slot] = tile that currently sits there; tile `empty` is the gap
    const board = [];
    for (let i = 0; i < tileCount; i++) board.push(i);
    let emptySlot = empty;

    function neighbors(slot) {
        const row = Math.floor(slot / size);
        const col = slot % size;
        const result = [];
        if (row > 0) result.push(slot - size);
        if (row < size - 1) result.push(slot + size);
        if (col > 0) result.push(slot - 1);
        if (col < size - 1) result.push(slot + 1);
        return result;
    }

    function isSolved() {
        return board.every((tile, slot) => tile === slot);
    }

    function slideTile(slot) {
        board[emptySlot] = board[slot];
        board[slot] = empty;
        emptySlot = slot;
    }

    // Shuffle with random valid moves only, so the puzzle is always solvable
    let lastFilled = -1;
    for (let i = 0; i < 30 || isSolved(); i++) {
        const choices = neighbors(emptySlot).filter(slot => slot !== lastFilled);
        lastFilled = emptySlot;
        slideTile(choices[Math.floor(Math.random() * choices.length)]);
    }

    const grid = document.createElement('div');
    grid.className = 'slider-grid';
    options.appendChild(grid);

    let done = false;
    let finishTimer = null;
    const cells = [];
    for (let slot = 0; slot < tileCount; slot++) {
        const cell = document.createElement('button');
        cell.className = 'slider-tile';
        cell.onclick = () => {
            if (done || board[slot] === empty) return;
            if (!neighbors(slot).includes(emptySlot)) return;
            slideTile(slot);
            render();
            if (isSolved()) {
                done = true;
                finishTimer = setTimeout(() => solvePuzzle(true), 600);
            }
        };
        grid.appendChild(cell);
        cells.push(cell);
    }

    function render() {
        cells.forEach((cell, slot) => {
            const tile = board[slot];
            cell.dataset.tile = tile;
            if (tile === empty) {
                cell.className = 'slider-tile empty';
                cell.style.backgroundImage = '';
                cell.style.backgroundPosition = '';
                cell.innerText = '';
            } else if (imageUrl) {
                cell.className = 'slider-tile';
                cell.style.backgroundImage = `url(${imageUrl})`;
                cell.style.backgroundPosition =
                    `-${(tile % size) * tileSize}px -${Math.floor(tile / size) * tileSize}px`;
                cell.innerText = '';
            } else {
                cell.className = 'slider-tile';
                cell.style.backgroundImage = '';
                cell.style.backgroundPosition = '';
                cell.innerText = tile + 1;
            }
        });
    }
    render();

    puzzleCleanup = () => clearTimeout(finishTimer);
}

// Puzzle 6 (Flutter-bird): click all the drifting feathers before time runs out
function setupCatchPuzzle(title, options, pokemon) {
    title.innerText = `${pokemon.name} shook loose its feathers! Catch them all before they blow away.`;

    const totalFeathers = 8;
    const timeLimit = 20;
    const featherSize = 30;

    const status = document.createElement('p');
    status.className = 'puzzle-status';
    options.appendChild(status);

    const area = document.createElement('div');
    area.className = 'catch-area';
    options.appendChild(area);

    const areaWidth = 260;
    const areaHeight = 220;
    let remaining = totalFeathers;
    let timeLeft = timeLimit;
    let finished = false;

    function updateStatus() {
        status.innerText = 'Time: ' + timeLeft + 's — Feathers: ' + remaining + '/' + totalFeathers;
    }
    updateStatus();

    const feathers = [];
    for (let i = 0; i < totalFeathers; i++) {
        const btn = document.createElement('button');
        btn.className = 'catch-feather';
        btn.innerText = '\u{1FAB6}'; // 🪶
        const feather = {
            el: btn,
            x: Math.random() * (areaWidth - featherSize),
            y: Math.random() * (areaHeight - featherSize),
            vx: (Math.random() * 1.6 + 0.7) * (Math.random() < 0.5 ? -1 : 1),
            vy: (Math.random() * 1.6 + 0.7) * (Math.random() < 0.5 ? -1 : 1)
        };
        btn.onclick = () => {
            if (finished) return;
            const idx = feathers.indexOf(feather);
            if (idx !== -1) feathers.splice(idx, 1);
            btn.remove();
            remaining--;
            updateStatus();
            if (remaining === 0) {
                finish(true);
            }
        };
        area.appendChild(btn);
        feathers.push(feather);
    }

    let rafId = null;
    function drift() {
        feathers.forEach(f => {
            f.x += f.vx;
            f.y += f.vy;
            if (f.x <= 0) { f.x = 0; f.vx = Math.abs(f.vx); }
            if (f.x >= areaWidth - featherSize) { f.x = areaWidth - featherSize; f.vx = -Math.abs(f.vx); }
            if (f.y <= 0) { f.y = 0; f.vy = Math.abs(f.vy); }
            if (f.y >= areaHeight - featherSize) { f.y = areaHeight - featherSize; f.vy = -Math.abs(f.vy); }
            f.el.style.left = f.x + 'px';
            f.el.style.top = f.y + 'px';
        });
        rafId = requestAnimationFrame(drift);
    }
    rafId = requestAnimationFrame(drift);

    const countdown = setInterval(() => {
        timeLeft--;
        updateStatus();
        if (timeLeft <= 0) {
            finish(false);
        }
    }, 1000);

    function stopLoops() {
        finished = true;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        clearInterval(countdown);
    }

    function finish(won) {
        if (finished) return;
        stopLoops();
        solvePuzzle(won);
    }

    puzzleCleanup = stopLoops;
}

function solvePuzzle(isCorrect) {
    if (isCorrect) {
        currentPokemon.caught = true;
        currentPokemon.setAlpha(0.5); // Make it translucent to indicate it's caught
        game.registry.set('caughtCount', game.registry.get('caughtCount') + 1);
        hidePuzzle();
        showDialogue("The Pokemon is happy! It was added to your Pokedex.");
    } else {
        hidePuzzle();
        showDialogue("The Pokemon didn't like that... Talk to it again to retry!");
    }
}

function hidePuzzle() {
    puzzleActive = false;
    currentPokemon = null;
    lastInteract = Date.now(); // reset cooldown WHEN they close it
    if (puzzleCleanup) {
        puzzleCleanup();
        puzzleCleanup = null;
    }
    document.getElementById('puzzle-ui').classList.add('hidden');
    if(player) {
        player.setVelocity(0,0);
        cursors.left.reset();
        cursors.right.reset();
        cursors.up.reset();
        cursors.down.reset();
    }
}
