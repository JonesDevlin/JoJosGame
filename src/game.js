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
    this.load.image('bg', 'assets/classroom_bg.jpg?v=3');
    this.load.image('player', 'assets/player.png?v=4');
    this.load.image('teacher', 'assets/teacher.png?v=3');
    this.load.image('pokemon1', 'assets/pokemon1.png?v=3');
    this.load.image('pokemon2', 'assets/pokemon2.png?v=3');
    this.load.image('pokemon3', 'assets/pokemon3.png?v=3');
}

function create() {
    // Add background and scale to fit
    let bg = this.add.image(400, 300, 'bg');
    bg.setDisplaySize(800, 600);

    // Create Teacher
    teacher = this.physics.add.staticSprite(400, 100, 'teacher');
    teacher.setDisplaySize(64, 64);
    
    // Create Pokemons
    const p1 = this.physics.add.staticSprite(200, 400, 'pokemon1');
    const p2 = this.physics.add.staticSprite(600, 400, 'pokemon2');
    const p3 = this.physics.add.staticSprite(400, 500, 'pokemon3');
    p1.name = 'Bulba-plant';
    p2.name = 'Char-lizard';
    p3.name = 'Squirt-turtle';
    
    pokemons = [p1, p2, p3];
    pokemons.forEach(p => {
        p.setDisplaySize(64, 64);
        p.caught = false;
    });

    // Create Player
    player = this.physics.add.sprite(400, 300, 'player');
    player.setDisplaySize(64, 64);
    player.setCollideWorldBounds(true);

    // Idle breathing tweens
    this.tweens.add({
        targets: [player, teacher, ...pokemons],
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
    } else if (cursors.up.isDown) {
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

function showPuzzle(pokemon) {
    puzzleActive = true;
    currentPokemon = pokemon;
    
    const ui = document.getElementById('puzzle-ui');
    const title = document.getElementById('puzzle-text');
    const options = document.getElementById('puzzle-options');
    
    ui.classList.remove('hidden');
    title.innerText = `A wild ${pokemon.name} appeared! How will you make it happy?`;
    
    options.innerHTML = '';
    
    // Simple quiz puzzle
    const puzzles = [
        { q: "Give it a berry", correct: true },
        { q: "Yell at it", correct: false },
        { q: "Sing a lullaby", correct: true },
        { q: "Throw a rock", correct: false }
    ];
    
    // Randomize and pick 3 options
    puzzles.sort(() => Math.random() - 0.5);
    const selectedOptions = puzzles.slice(0, 3);
    
    selectedOptions.forEach(p => {
        let btn = document.createElement('button');
        btn.className = 'puzzle-btn';
        btn.innerText = p.q;
        btn.onclick = () => solvePuzzle(p.correct);
        options.appendChild(btn);
    });
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
        showDialogue("The Pokemon didn't like that...");
    }
}

function hidePuzzle() {
    puzzleActive = false;
    currentPokemon = null;
    lastInteract = Date.now(); // reset cooldown WHEN they close it
    document.getElementById('puzzle-ui').classList.add('hidden');
    if(player) {
        player.setVelocity(0,0);
        cursors.left.reset();
        cursors.right.reset();
        cursors.up.reset();
        cursors.down.reset();
    }
}
