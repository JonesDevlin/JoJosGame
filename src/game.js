const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
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
let teacher;
let pokemons = [];
let hasPokedex = false;
let pokedexCount = 0;
const totalPokemons = 3;
let puzzleActive = false;
let dialogueActive = false;
let currentPokemon = null;

function preload() {
    this.load.image('bg', 'assets/classroom_bg.jpg');
    this.load.image('player', 'assets/player.jpg');
    this.load.image('teacher', 'assets/teacher.jpg');
    this.load.image('pokemon1', 'assets/pokemon1.jpg');
    this.load.image('pokemon2', 'assets/pokemon2.jpg');
    this.load.image('pokemon3', 'assets/pokemon3.jpg');
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

    // Collisions and interactions
    this.physics.add.collider(player, teacher, interactTeacher, null, this);
    pokemons.forEach(p => {
        this.physics.add.collider(player, p, interactPokemon, null, this);
    });

    // Input
    cursors = this.input.keyboard.createCursorKeys();
    
    // Setup UI buttons
    document.getElementById('puzzle-close').addEventListener('click', () => {
        hidePuzzle();
    });
    document.getElementById('dialogue-close').addEventListener('click', () => {
        hideDialogue();
    });
}

function update() {
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
}

let lastInteract = 0;

function interactTeacher(playerSprite, teacherSprite) {
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
    
    lastInteract = Date.now();
    
    // Bounce player back to prevent re-triggering immediately
    if (playerSprite.y < teacherSprite.y) {
        playerSprite.y -= 20;
    } else {
        playerSprite.y += 20;
    }
}

function interactPokemon(playerSprite, pokemon) {
    if (dialogueActive || puzzleActive) return;

    if (!hasPokedex) {
        let now = Date.now();
        if (now - lastInteract < 2000) return;
        showDialogue("You need a Pokedex from the Professor first!");
        lastInteract = Date.now();
        if (playerSprite.y < pokemon.y) playerSprite.y -= 20;
        else playerSprite.y += 20;
        return;
    }

    if (pokemon.caught) return;
    
    if (playerSprite.y < pokemon.y) playerSprite.y -= 20;
    else playerSprite.y += 20; // Bounce to un-collide
    
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
    document.getElementById('puzzle-ui').classList.add('hidden');
    if(player) {
        player.setVelocity(0,0);
        cursors.left.reset();
        cursors.right.reset();
        cursors.up.reset();
        cursors.down.reset();
    }
}
