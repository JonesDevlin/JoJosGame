// Shared state bound to whichever scene is active (dialogue/puzzle overlay
// functions and console testing rely on these staying module-scope globals)
let activeScene = null;
let player;
let cursors;
let pokemons = [];
let puzzleActive = false;
let dialogueActive = false;
let currentSpeechAudio = null;
let currentPokemon = null;
let lastInteract = 0;

// State of the on-screen touch controls (D-pad + "A" button in index.html).
// Directions are level-based (held), interactPending is edge-based: set on
// tap, consumed once by consumeVirtualInteract() so one tap = one interaction.
const virtualInput = { up: false, down: false, left: false, right: false, interactPending: false };

function consumeVirtualInteract() {
    const pending = virtualInput.interactPending;
    virtualInput.interactPending = false;
    return pending;
}

const CLASSROOM_TOTAL = 3;
const SCHOOLYARD_TOTAL = 6; // full Pokedex: 3 classroom + 3 yard Pokemon
const CLASSROOM_EXIT = { y: 535, minX: 350, maxX: 450 };
const SCHOOLYARD_EXIT = { y: 516, minX: 334, maxX: 460 };

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

// Space (or a virtual A tap) closes an open dialogue; returns true while an
// overlay blocks gameplay
function overlayBlocking(scene) {
    if (dialogueActive && (Phaser.Input.Keyboard.JustDown(scene.interactKey) || consumeVirtualInteract())) {
        hideDialogue();
        return true; // Prevent triggering interactions in the same frame
    }
    if (puzzleActive || dialogueActive) {
        // Drop any stale A tap made while blocked so it can't fire a ghost
        // interaction on the frame after the overlay closes
        virtualInput.interactPending = false;
        scene.player.setVelocity(0);
        scene.interactHint.setVisible(false);
        return true;
    }
    return false;
}

function updatePlayerMovement(scene) {
    const speed = 200;
    scene.player.setVelocity(0);

    if (scene.cursors.left.isDown || virtualInput.left) {
        scene.player.setVelocityX(-speed);
    } else if (scene.cursors.right.isDown || virtualInput.right) {
        scene.player.setVelocityX(speed);
    }

    if (scene.cursors.up.isDown || virtualInput.up) {
        scene.player.setVelocityY(-speed);
    } else if (scene.cursors.down.isDown || virtualInput.down) {
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
        this.teacher = createNpc(this, 400, 205, 'teacher', 100, 46, 62, 20);

        // Create Pokemons
        const p1 = createNpc(this, 200, 400, 'pokemon1', 64, 28, 48, 16);
        const p2 = createNpc(this, 600, 400, 'pokemon2', 64, 28, 48, 16);
        const p3 = createNpc(this, 250, 550, 'pokemon3', 64, 28, 48, 16);
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
            // Collision boxes are slimmer than the desk art so the aisles
            // stay comfortably walkable, especially with the touch stick
            const desk = this.add.rectangle(x, y, 60, 34);
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
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.teacher.x, this.teacher.y) < 100) {
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
        if (Phaser.Input.Keyboard.JustDown(this.interactKey) || consumeVirtualInteract()) {
            if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.teacher.x, this.teacher.y) < 100) {
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

// Level 2: the schoolyard at recess — Coach and 3 rowdier Pokemon.
// Background is assets/schoolyard_bg.jpg (AI-generated, 1024x1024; canvas
// coords = image coords * 0.78125 (x) / 0.5859375 (y)): school wall+door at
// top (grass starts at image y=384 -> canvas y=225), a single tree upper
// right (image x706-979,y236-650), a sandbox left-center (image x227-423,
// y590-734), and a fence with a gate gap at image x428-589 (canvas x334-460)
// running along the bottom at image y~780-880 (canvas y~457-516).
class SchoolyardScene extends Phaser.Scene {
    constructor() {
        super('SchoolyardScene');
    }

    preload() {
        this.load.image('yard_bg', 'assets/schoolyard_bg.jpg?v=2');
        this.load.image('coach', 'assets/coach.png?v=2');
        this.load.image('pokemon4', 'assets/pokemon4.png?v=3');
        this.load.image('pokemon5', 'assets/pokemon5.png?v=3');
        this.load.image('pokemon6', 'assets/pokemon6.png?v=3');
        this.load.image('mimi', 'assets/mimi.png?v=2');
    }

    create() {
        if (this.registry.get('coachIntro') === undefined) {
            this.registry.set('coachIntro', false);
        }
        // Pokemon interactions in this scene are locked behind Coach's pep
        // talk (checked by the global interactPokemon)
        this.requireCoachIntro = true;

        let bg = this.add.image(400, 300, 'yard_bg');
        bg.setDisplaySize(800, 600);

        // Coach stands beside the sandbox, keeping an eye on recess
        this.coach = createNpc(this, 300, 260, 'coach', 100, 46, 62, 20);

        // The three yard Pokemon, spread around the field clear of the tree
        // and sandbox art
        const p4 = createNpc(this, 150, 300, 'pokemon4', 64, 28, 48, 16);
        const p5 = createNpc(this, 580, 430, 'pokemon5', 64, 28, 48, 16);
        const p6 = createNpc(this, 730, 270, 'pokemon6', 64, 28, 48, 16);
        p4.name = 'Volt-spark';
        p5.name = 'Ruby-scale';
        p6.name = 'Frost-wing';
        p4.puzzleType = 'maze';
        p5.puzzleType = 'whack';
        p6.puzzleType = 'rhythm';
        this.pokemons = [p4, p5, p6];
        this.pokemons.forEach(p => {
            p.caught = false;
        });

        // Mimi-Q pedals its bicycle back and forth across the yard (pure
        // decoration + a chat, not part of the Pokedex — no physics body)
        this.mimiShadow = this.add.ellipse(110, 465, 56, 14, 0x000000, 0.22);
        this.mimi = this.add.sprite(110, 430, 'mimi');
        this.mimi.setDisplaySize(78, 78);
        this.mimi.name = 'Mimi-Q';
        this.tweens.add({
            targets: [this.mimi, this.mimiShadow],
            x: 690,
            duration: 7000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            onYoyo: () => this.mimi.setFlipX(true),
            onRepeat: () => this.mimi.setFlipX(false)
        });

        // Player fades in at the top center, just below the school door
        this.playerShadow = this.add.ellipse(400, 252, 52, 17, 0x000000, 0.22);
        this.player = createPlayer(this, 400, 260);

        // Keep the player inside the fence (top = school wall base, bottom
        // gives a little room past the gate's y for the exit-zone check)
        this.physics.world.setBounds(40, 225, 720, 335);

        // Invisible static colliders matching the background art
        const obstacles = this.physics.add.staticGroup();
        const addObstacle = (x, y, w, h) => {
            const r = this.add.rectangle(x, y, w, h);
            this.physics.add.existing(r, true);
            obstacles.add(r);
        };
        addObstacle(254, 388, 150, 85);   // sandbox (image x227-423, y590-734)
        addObstacle(658, 300, 110, 130);  // the yard's single tree (image x706-979, y236-650)
        // Bottom fence, split by the gate opening (canvas x334-460)
        addObstacle(187, 487, 294, 60);   // fence left of gate
        addObstacle(610, 487, 300, 60);   // fence right of gate
        this.physics.add.collider(this.player, obstacles);

        this.interactHint = createInteractHint(this);

        this.physics.add.collider(this.player, this.coach);
        this.pokemons.forEach(p => {
            this.physics.add.collider(this.player, p);
        });

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

        // School gate at the bottom: blocked until the Pokedex is complete,
        // then it triggers the graduation ending
        if (inExitZone(this.player, SCHOOLYARD_EXIT)) {
            if (this.registry.get('caughtCount') >= SCHOOLYARD_TOTAL) {
                this.exiting = true;
                this.player.setVelocity(0);
                this.interactHint.setVisible(false);
                this.cameras.main.fadeOut(900, 0, 0, 0);
                this.cameras.main.once('camerafadeoutcomplete', () => {
                    document.getElementById('ending-ui').classList.remove('hidden');
                });
                return;
            } else if (!dialogueActive && !puzzleActive) {
                this.player.setPosition(this.player.x, 515); // step back from the gate
                showDialogue("Coach: Recess isn't over! "
                    + (SCHOOLYARD_TOTAL - this.registry.get('caughtCount'))
                    + " Pokemon still need cheering up before you can head out the gate.");
            }
        }

        if (overlayBlocking(this)) return;

        let hintTarget = null;
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.coach.x, this.coach.y) < 80) {
            hintTarget = this.coach;
        }
        this.pokemons.forEach(p => {
            if (!p.caught && Phaser.Math.Distance.Between(this.player.x, this.player.y, p.x, p.y) < 80) {
                hintTarget = p;
            }
        });
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.mimi.x, this.mimi.y) < 80) {
            hintTarget = this.mimi;
        }
        updateInteractHint(this.interactHint, hintTarget, time);

        updatePlayerMovement(this);

        // Interaction with Spacebar
        if (Phaser.Input.Keyboard.JustDown(this.interactKey) || consumeVirtualInteract()) {
            if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.coach.x, this.coach.y) < 80) {
                interactCoach();
            } else if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.mimi.x, this.mimi.y) < 80) {
                interactMimi();
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

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    pixelArt: true,
    // Letterbox the fixed 800x600 world onto any screen; gameplay
    // coordinates stay in the same 800x600 space
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 800,
        height: 600
    },
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
// Tapping anywhere on the dialogue box also dismisses it (parity with Space;
// the OK button's click bubbles here too, which is a harmless double-hide)
document.getElementById('dialogue-ui').addEventListener('click', () => {
    hideDialogue();
});
document.getElementById('music-toggle').addEventListener('click', (e) => {
    const muted = Music.toggleMute();
    e.target.innerHTML = muted ? '&#128263;' : '&#128266;';
    if (muted && currentSpeechAudio) {
        currentSpeechAudio.pause();
        currentSpeechAudio = null;
    }
});

// ---- Virtual touch controls (elements live in index.html, shown via CSS on
// coarse-pointer devices). The stick and the A button each track their own
// pointer, so dragging to move while tapping A works (multi-touch). ----

// Compact drag-stick: press anywhere in the box and drag; the nub follows the
// finger and the drag vector sets the movement flags (with a deadzone).
const touchStick = document.getElementById('touch-stick');
const stickNub = document.getElementById('stick-nub');
const STICK_DEADZONE = 10; // px of drag before a direction engages
const STICK_RANGE = 34;    // max px the nub travels from center
let stickPointerId = null;

function updateStick(e) {
    const rect = touchStick.getBoundingClientRect();
    let dx = e.clientX - (rect.left + rect.width / 2);
    let dy = e.clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > STICK_RANGE) {
        dx = dx / len * STICK_RANGE;
        dy = dy / len * STICK_RANGE;
    }
    stickNub.style.transform = `translate(${dx}px, ${dy}px)`;
    virtualInput.left = dx < -STICK_DEADZONE;
    virtualInput.right = dx > STICK_DEADZONE;
    virtualInput.up = dy < -STICK_DEADZONE;
    virtualInput.down = dy > STICK_DEADZONE;
}

function resetStick() {
    stickPointerId = null;
    touchStick.classList.remove('active');
    stickNub.style.transform = '';
    virtualInput.left = virtualInput.right = virtualInput.up = virtualInput.down = false;
}

touchStick.addEventListener('pointerdown', (e) => {
    e.preventDefault(); // no focus steal / synthetic mouse events
    stickPointerId = e.pointerId;
    touchStick.setPointerCapture(e.pointerId);
    touchStick.classList.add('active');
    updateStick(e);
});
touchStick.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickPointerId) updateStick(e);
});
['pointerup', 'pointercancel'].forEach(ev => {
    touchStick.addEventListener(ev, (e) => {
        if (e.pointerId === stickPointerId) resetStick();
    });
});
touchStick.addEventListener('contextmenu', (e) => e.preventDefault()); // long-press

const interactBtn = document.getElementById('touch-interact');
interactBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    virtualInput.interactPending = true;
    interactBtn.classList.add('pressed');
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => {
    interactBtn.addEventListener(ev, () => interactBtn.classList.remove('pressed'));
});
interactBtn.addEventListener('contextmenu', (e) => e.preventDefault());

// ---- Level chrome: title cards + Pokedex HUD (global, outside the scenes) ----

const LEVEL_TITLES = {
    ClassroomScene: 'Room 123',
    SchoolyardScene: 'Level 2: The Schoolyard'
};

const LEVEL_TRACKS = {
    ClassroomScene: 'classroom',
    SchoolyardScene: 'schoolyard'
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
        const initScene = () => {
            if (s.sys.sceneInitialized) return;
            s.sys.sceneInitialized = true;
            showLevelTitle(s.scene.key);
            Music.setTrack(LEVEL_TRACKS[s.scene.key]);
        };
        s.sys.events.on(Phaser.Scenes.Events.CREATE, initScene);
        // If assets were cached, CREATE may have fired synchronously before this hook
        if (s.sys.settings.status >= 5) { // RUNNING
            initScene();
        }
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

    // Schoolyard-only gate: Coach's pep talk unlocks the yard Pokemon
    // (scenes opt in via this.requireCoachIntro; Level 1 is unaffected)
    if (activeScene && activeScene.requireCoachIntro && !game.registry.get('coachIntro')) {
        showDialogue("Talk to Coach first!");
        return;
    }

    if (pokemon.caught) return;

    showPuzzle(pokemon);
}

function interactMimi() {
    if (dialogueActive || puzzleActive) return;

    let now = Date.now();
    if (now - lastInteract < 1000) return;

    showDialogue("Mimi-Q: Ring ring! Nice wheels, right? I never take my costume off while riding — helmet hair!");
}

function interactCoach() {
    if (dialogueActive || puzzleActive) return;

    let now = Date.now();
    if (now - lastInteract < 1000) return;

    const caughtCount = game.registry.get('caughtCount');
    if (!game.registry.get('coachIntro')) {
        game.registry.set('coachIntro', true);
        showDialogue("Coach: Welcome to recess! Three elemental dragons are running wild out here — show me your Academy spirit and cheer them up!");
    } else if (caughtCount < SCHOOLYARD_TOTAL) {
        showDialogue("Coach: Keep that energy up! " + (SCHOOLYARD_TOTAL - caughtCount) + " elemental dragons still need cheering up.");
    } else {
        showDialogue("Coach: Outstanding hustle! Your Pokedex is complete — head out the school gate at the bottom of the yard!");
    }
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

    // Stop any currently playing speech
    if (currentSpeechAudio) {
        currentSpeechAudio.pause();
        currentSpeechAudio = null;
    }

    // Check if the dialogue is from the Professor and play generated speech if not muted
    if (text.startsWith("Professor:") && !Music.isMuted()) {
        let audioSrc = null;
        if (text.includes("Welcome to the Academy")) {
            audioSrc = 'assets/audio/prof_welcome.mp3';
        } else if (text.includes("You still have")) {
            if (text.includes("3")) {
                audioSrc = 'assets/audio/prof_catch_3.mp3';
            } else if (text.includes("2")) {
                audioSrc = 'assets/audio/prof_catch_2.mp3';
            } else if (text.includes("1")) {
                audioSrc = 'assets/audio/prof_catch_1.mp3';
            }
        } else if (text.includes("Amazing! You completed the Pokedex")) {
            audioSrc = 'assets/audio/prof_amazing.mp3';
        } else if (text.includes("Class is in session")) {
            audioSrc = 'assets/audio/prof_session.mp3';
        } else if (text.includes("Not so fast!")) {
            if (text.includes("3")) {
                audioSrc = 'assets/audio/prof_not_so_fast_3.mp3';
            } else if (text.includes("2")) {
                audioSrc = 'assets/audio/prof_not_so_fast_2.mp3';
            } else if (text.includes("1")) {
                audioSrc = 'assets/audio/prof_not_so_fast_1.mp3';
            }
        }

        if (audioSrc) {
            currentSpeechAudio = new Audio(audioSrc);
            currentSpeechAudio.volume = 0.8;
            currentSpeechAudio.play().catch(err => console.log("Speech audio play failed:", err));
        }
    } else if (text.startsWith("Coach:") && !Music.isMuted()) {
        let audioSrc = null;
        if (text.includes("Welcome to recess")) {
            audioSrc = 'assets/audio/coach_welcome.mp3';
        } else if (text.includes("Outstanding hustle")) {
            audioSrc = 'assets/audio/coach_hustle.mp3';
        } else if (text.includes("Keep that energy up")) {
            if (text.includes("3")) {
                audioSrc = 'assets/audio/coach_keep_up_3.mp3';
            } else if (text.includes("2")) {
                audioSrc = 'assets/audio/coach_keep_up_2.mp3';
            } else if (text.includes("1")) {
                audioSrc = 'assets/audio/coach_keep_up_1.mp3';
            }
        } else if (text.includes("Recess isn't over")) {
            if (text.includes("3")) {
                audioSrc = 'assets/audio/coach_recess_not_over_3.mp3';
            } else if (text.includes("2")) {
                audioSrc = 'assets/audio/coach_recess_not_over_2.mp3';
            } else if (text.includes("1")) {
                audioSrc = 'assets/audio/coach_recess_not_over_1.mp3';
            }
        }

        if (audioSrc) {
            currentSpeechAudio = new Audio(audioSrc);
            currentSpeechAudio.volume = 0.8;
            currentSpeechAudio.play().catch(err => console.log("Speech audio play failed:", err));
        }
    } else if (text.startsWith("Mimi-Q:") && !Music.isMuted()) {
        let audioSrc = null;
        if (text.includes("helmet hair")) {
            audioSrc = 'assets/audio/mimi_hair.mp3';
        }

        if (audioSrc) {
            currentSpeechAudio = new Audio(audioSrc);
            currentSpeechAudio.volume = 0.8;
            currentSpeechAudio.play().catch(err => console.log("Speech audio play failed:", err));
        }
    }
}

function hideDialogue() {
    dialogueActive = false;
    lastInteract = Date.now(); // reset cooldown WHEN they close it
    virtualInput.interactPending = false; // drop any tap queued while open
    document.getElementById('dialogue-ui').classList.add('hidden');

    if (currentSpeechAudio) {
        currentSpeechAudio.pause();
        currentSpeechAudio = null;
    }
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
    } else if (pokemon.puzzleType === 'maze') {
        setupMazePuzzle(title, options, pokemon);
    } else if (pokemon.puzzleType === 'whack') {
        setupWhackPuzzle(title, options, pokemon);
    } else if (pokemon.puzzleType === 'rhythm') {
        setupRhythmPuzzle(title, options, pokemon);
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

// Puzzle 4 (Ruby-spark): trace the spark through the wire maze without
// touching the walls (steady-hand game; touching a wall resets to the start)
function setupMazePuzzle(title, options, pokemon) {
    title.innerText = `${pokemon.name}'s flame spark bounced away! Pick it up and guide it through the maze to the bulb.`;

    // S = start, G = goal, # = wall, . = open corridor (serpentine path)
    const layout = [
        'S.......#',
        '#######.#',
        '#.......#',
        '#.#######',
        '#.......#',
        '#######.#',
        '#######G#'
    ];

    const status = document.createElement('p');
    status.className = 'puzzle-status';
    status.innerText = 'Touch the spark to pick it up!';
    options.appendChild(status);

    const grid = document.createElement('div');
    grid.className = 'maze-grid';
    options.appendChild(grid);

    let tracing = false;
    let done = false;
    let finishTimer = null;
    let startCell = null;
    let lastCell = null;

    function resetSpark() {
        tracing = false;
        grid.classList.add('zapped');
        setTimeout(() => grid.classList.remove('zapped'), 250);
        startCell.innerText = '⚡';
        status.innerText = 'Bzzt! Back to the start...';
        Array.from(grid.querySelectorAll('.lit')).forEach(c => c.classList.remove('lit'));
    }

    layout.forEach(row => {
        [...row].forEach(ch => {
            const cell = document.createElement('div');
            cell.className = 'maze-cell ' + (ch === '#' ? 'wall' : 'path');
            cell.dataset.ch = ch;
            if (ch === 'S') {
                cell.classList.add('start');
                cell.innerText = '⚡';
                startCell = cell;
            }
            if (ch === 'G') {
                cell.classList.add('goal');
                cell.innerText = '💡';
            }
            grid.appendChild(cell);
        });
    });

    // Fires once per cell "entered" (mouse hover or finger drag alike)
    function enterCell(cell) {
        if (done || cell === lastCell) return;
        lastCell = cell;
        const ch = cell.dataset.ch;
        if (ch === 'S') {
            tracing = true;
            startCell.innerText = '';
            status.innerText = 'Careful... guide it to the bulb!';
            Array.from(grid.querySelectorAll('.lit')).forEach(c => c.classList.remove('lit'));
        } else if (ch === '#') {
            if (tracing) resetSpark();
        } else if (ch === '.' && tracing) {
            cell.classList.add('lit');
        } else if (ch === 'G' && tracing) {
            done = true;
            cell.innerText = '✨';
            status.innerText = 'The bulb lit up!';
            finishTimer = setTimeout(() => solvePuzzle(true), 600);
        }
    }

    // Grid-level pointer handling: per-cell mouseenter never fires for a
    // finger drag, so resolve the cell under the pointer by coordinates.
    // pointermove also fires for plain mouse hover, keeping desktop play.
    function handlePointer(e) {
        const target = document.elementFromPoint(e.clientX, e.clientY);
        if (target && target.parentElement === grid) enterCell(target);
    }
    function clearLastCell() {
        lastCell = null;
    }
    grid.addEventListener('pointerdown', handlePointer);
    grid.addEventListener('pointermove', handlePointer);
    grid.addEventListener('pointerleave', clearLastCell);

    puzzleCleanup = () => {
        clearTimeout(finishTimer);
        grid.removeEventListener('pointerdown', handlePointer);
        grid.removeEventListener('pointermove', handlePointer);
        grid.removeEventListener('pointerleave', clearLastCell);
    };
}

// Puzzle 5 (Ruby-scale): whack-a-dragon — it pops out of holes, bop it
// 8 times before the timer runs out
function setupWhackPuzzle(title, options, pokemon) {
    title.innerText = `${pokemon.name} is playing hide and seek! Bop it 8 times before recess ends.`;

    const targetBops = 8;
    const timeLimit = 25;
    let bops = 0;
    let timeLeft = timeLimit;
    let finished = false;

    const status = document.createElement('p');
    status.className = 'puzzle-status';
    options.appendChild(status);

    function updateStatus() {
        status.innerText = 'Bops: ' + bops + '/' + targetBops + ' — Time: ' + timeLeft + 's';
    }
    updateStatus();

    const grid = document.createElement('div');
    grid.className = 'whack-grid';
    options.appendChild(grid);

    const holes = [];
    for (let i = 0; i < 9; i++) {
        const hole = document.createElement('button');
        hole.className = 'whack-hole';
        hole.onclick = () => {
            if (finished || !hole.classList.contains('up')) return;
            hole.classList.remove('up');
            hole.classList.add('bopped');
            setTimeout(() => hole.classList.remove('bopped'), 200);
            hole.innerText = '💫';
            bops++;
            updateStatus();
            if (bops >= targetBops) finish(true);
        };
        grid.appendChild(hole);
        holes.push(hole);
    }

    // The duckling face: reuse the Pokemon's own art when available
    const duckFace = (pokemon.texture && pokemon.texture.key)
        ? `<img src="assets/${pokemon.texture.key}.png" alt="">`
        : '🦆';

    let popTimer = null;
    let lastHole = -1;
    function popNext() {
        holes.forEach(h => { h.classList.remove('up'); h.innerText = ''; h.innerHTML = ''; });
        let i = Math.floor(Math.random() * 9);
        while (i === lastHole) i = Math.floor(Math.random() * 9);
        lastHole = i;
        holes[i].classList.add('up');
        holes[i].innerHTML = duckFace;
        popTimer = setTimeout(popNext, 900);
    }
    popTimer = setTimeout(popNext, 500);

    const countdown = setInterval(() => {
        timeLeft--;
        updateStatus();
        if (timeLeft <= 0) finish(false);
    }, 1000);

    function stopLoops() {
        finished = true;
        clearTimeout(popTimer);
        clearInterval(countdown);
    }

    function finish(won) {
        if (finished) return;
        stopLoops();
        solvePuzzle(won);
    }

    puzzleCleanup = stopLoops;
}

// Puzzle 6 (Ruby-wing): rhythm game — tap the drum exactly when the
// shrinking ring closes on it; hit 4 of 6 beats
function setupRhythmPuzzle(title, options, pokemon) {
    title.innerText = `${pokemon.name} wants to dance! Tap the drum right when the ring closes on it.`;

    const totalRings = 6;
    const neededHits = 4;
    const ringDuration = 1500; // ms from spawn to fully closed
    const perfectAt = 1125;    // ms after spawn when scale passes 1.0
    const tolerance = 220;     // ms window around the perfect moment

    let hits = 0;
    let ringsDone = 0;
    let finished = false;

    const status = document.createElement('p');
    status.className = 'puzzle-status';
    options.appendChild(status);

    function updateStatus() {
        status.innerText = 'Hits: ' + hits + '/' + neededHits + ' — Beats left: ' + (totalRings - ringsDone);
    }
    updateStatus();

    const area = document.createElement('div');
    area.className = 'rhythm-area';
    options.appendChild(area);

    const drum = document.createElement('button');
    drum.className = 'rhythm-drum';
    drum.innerText = '🥁';
    area.appendChild(drum);

    const timers = [];
    let rafId = null;
    let activeRing = null; // { el, spawnedAt, judged }

    function spawnRing() {
        const el = document.createElement('div');
        el.className = 'rhythm-ring';
        area.appendChild(el);
        activeRing = { el, spawnedAt: performance.now(), judged: false };
        timers.push(setTimeout(() => {
            if (!activeRing || activeRing.el !== el) return;
            if (!activeRing.judged) {
                drum.classList.add('missed');
                timers.push(setTimeout(() => drum.classList.remove('missed'), 200));
            }
            el.remove();
            activeRing = null;
            ringDoneCheck();
        }, ringDuration + 150));
    }

    function ringDoneCheck() {
        ringsDone++;
        updateStatus();
        if (ringsDone >= totalRings) {
            finished = true;
            timers.push(setTimeout(() => solvePuzzle(hits >= neededHits), 500));
        }
    }

    // Visual shrink driven by rAF, but the click grading below uses
    // performance.now() directly so timing stays fair even if frames drop
    function animate() {
        if (activeRing) {
            const t = performance.now() - activeRing.spawnedAt;
            const scale = Math.max(0.6, 2.2 - (1.6 / ringDuration) * t);
            activeRing.el.style.transform = `translate(-50%, -50%) scale(${scale})`;
        }
        rafId = requestAnimationFrame(animate);
    }
    rafId = requestAnimationFrame(animate);

    drum.onclick = () => {
        if (finished || !activeRing || activeRing.judged) return;
        activeRing.judged = true;
        const t = performance.now() - activeRing.spawnedAt;
        if (Math.abs(t - perfectAt) <= tolerance) {
            hits++;
            drum.classList.add('hit');
            timers.push(setTimeout(() => drum.classList.remove('hit'), 200));
        } else {
            drum.classList.add('missed');
            timers.push(setTimeout(() => drum.classList.remove('missed'), 200));
        }
        updateStatus();
    };

    // One ring every 1.9s
    for (let i = 0; i < totalRings; i++) {
        timers.push(setTimeout(spawnRing, 800 + i * 1900));
    }

    puzzleCleanup = () => {
        finished = true;
        timers.forEach(t => clearTimeout(t));
        if (rafId) cancelAnimationFrame(rafId);
    };
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
    virtualInput.interactPending = false; // drop any tap queued while open
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
