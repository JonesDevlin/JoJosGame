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
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);
let player;
let cursors;
let interactKey;
let teacher;
let pokemons = [];
let hasPokedex = false;
let pokedexCount = 0;
const totalPokemons = 3;
let puzzleActive = false;
let dialogueActive = false;
let currentPokemon = null;

function preload() {
    this.load.image('bg', 'assets/classroom_bg.jpg?v=4');
    this.load.image('player', 'assets/player.png?v=5');
    this.load.image('teacher', 'assets/teacher.png?v=5');
    this.load.image('pokemon1', 'assets/pokemon1.png?v=5');
    this.load.image('pokemon2', 'assets/pokemon2.png?v=5');
    this.load.image('pokemon3', 'assets/pokemon3.png?v=5');
}

function create() {
    // Add background and scale to fit
    let bg = this.add.image(400, 300, 'bg');
    bg.setDisplaySize(800, 600);

    // Create Teacher (standing at the front of the class, below the blackboard)
    teacher = this.physics.add.staticSprite(400, 240, 'teacher');
    teacher.setDisplaySize(64, 64);
    teacher.refreshBody(); // static bodies don't follow setDisplaySize on their own

    // Create Pokemons
    const p1 = this.physics.add.staticSprite(200, 400, 'pokemon1');
    const p2 = this.physics.add.staticSprite(600, 400, 'pokemon2');
    const p3 = this.physics.add.staticSprite(400, 500, 'pokemon3');
    p1.name = 'Bulba-plant';
    p2.name = 'Char-lizard';
    p3.name = 'Squirt-turtle';
    p1.puzzleType = 'sequence';
    p2.puzzleType = 'timing';
    p3.puzzleType = 'match';
    
    pokemons = [p1, p2, p3];
    pokemons.forEach(p => {
        p.setDisplaySize(64, 64);
        p.refreshBody(); // static bodies don't follow setDisplaySize on their own
        p.caught = false;
    });

    // Create Player (spawns on the open floor at the bottom of the room)
    player = this.physics.add.sprite(400, 550, 'player');
    player.setDisplaySize(64, 64);
    // Collision box covers only the feet (in source-texture pixels, relative
    // to frame size) so the player can walk between desk rows top-down style
    player.body.setSize(player.width * 0.5, player.height * 0.22)
        .setOffset(player.width * 0.25, player.height * 0.74);
    player.setCollideWorldBounds(true);

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
    this.physics.add.collider(player, obstacles);

    // Idle breathing tweens
    this.tweens.add({
        targets: [teacher, ...pokemons], // Removed player so Y-axis physics work again
        y: '-=10', // Hover effect
        duration: 1000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });

    // Collisions (Solid barriers)
    this.physics.add.collider(player, teacher);
    pokemons.forEach(p => {
        this.physics.add.collider(player, p);
    });

    // Input
    cursors = this.input.keyboard.createCursorKeys();
    interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    
    // Setup UI buttons
    document.getElementById('puzzle-close').addEventListener('click', () => {
        hidePuzzle();
    });
    document.getElementById('dialogue-close').addEventListener('click', () => {
        hideDialogue();
    });
}

function update() {
    // Check if dialog is open and Spacebar is pressed
    if (dialogueActive && Phaser.Input.Keyboard.JustDown(interactKey)) {
        hideDialogue();
        return; // Prevent triggering interactions in the same frame
    }
    
    if (puzzleActive || dialogueActive) {
        player.setVelocity(0);
        return;
    }

    const speed = 200;
    player.setVelocity(0);

    if (cursors.left.isDown) {
        player.setVelocityX(-speed);
    } else if (cursors.right.isDown) {
        player.setVelocityX(speed);
    } 
    
    if (cursors.up.isDown) {
        player.setVelocityY(-speed);
    } else if (cursors.down.isDown) {
        player.setVelocityY(speed);
    }

    // Interaction with Spacebar
    if (Phaser.Input.Keyboard.JustDown(interactKey)) {
        if (Phaser.Math.Distance.Between(player.x, player.y, teacher.x, teacher.y) < 80) {
            interactTeacher();
        } else {
            pokemons.forEach(p => {
                if (Phaser.Math.Distance.Between(player.x, player.y, p.x, p.y) < 80) {
                    interactPokemon(p);
                }
            });
        }
    }
}

let lastInteract = 0;

function interactTeacher() {
    if (dialogueActive || puzzleActive) return;
    
    let now = Date.now();
    if (now - lastInteract < 1000) return;

    if (!hasPokedex) {
        hasPokedex = true;
        showDialogue("Professor: Welcome to the Academy! Here is your Pokedex. Go make 3 Pokemon happy!");
    } else if (pokedexCount < totalPokemons) {
        showDialogue("Professor: You still have " + (totalPokemons - pokedexCount) + " Pokemon to catch.");
    } else {
        showDialogue("Professor: Amazing! You completed the Pokedex! You pass!");
    }
}

function interactPokemon(pokemon) {
    if (dialogueActive || puzzleActive) return;
    
    let now = Date.now();
    if (now - lastInteract < 1000) return;

    if (!hasPokedex) {
        showDialogue("You need a Pokedex from the Professor first!");
        return;
    }

    if (pokemon.caught) return;
    
    showPuzzle(pokemon);
}

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

function solvePuzzle(isCorrect) {
    if (isCorrect) {
        currentPokemon.caught = true;
        currentPokemon.setAlpha(0.5); // Make it translucent to indicate it's caught
        pokedexCount++;
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
