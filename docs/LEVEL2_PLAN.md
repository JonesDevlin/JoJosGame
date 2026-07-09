# Level 2: The Schoolyard — Design & Task Plan

## Concept

After making all 3 classroom Pokemon happy, walking out the door (Pikachu rug)
no longer ends the game — it transitions to **Level 2: The Schoolyard** for
recess. Three rowdier Pokemon are loose on the playground, and **Coach**, the
gym teacher, challenges the player to calm them down with harder puzzles.
Completing all 3 and leaving through the school gate triggers the final
graduation ending (the current congratulations screen moves there, 6/6 Pokedex).

## Current architecture (what Level 2 builds on)

- Single Phaser 3 scene in `src/game.js` using module-scope globals
  (`player`, `teacher`, `pokemons`, `hasPokedex`, `pokedexCount`).
- Dialogue and puzzles are HTML overlays (`#dialogue-ui`, `#puzzle-ui` in
  `index.html`, styles in `style.css`), never browser alerts.
- Puzzle contract: each puzzle is a `setupXxxPuzzle(titleEl, optionsEl, pokemon)`
  function that builds DOM inside `#puzzle-options`, calls `solvePuzzle(bool)`
  when done, and assigns `puzzleCleanup` to a function that clears its
  timers/rAF loops (called by `hidePuzzle`). Puzzles are selected via
  `pokemon.puzzleType`. Level 1 types: `sequence`, `timing`, `match`.
- Interaction: Spacebar within 80px; a bobbing `!` hint (`interactHint`) marks
  in-range characters; characters have ellipse ground shadows; the player uses
  a feet-only physics box so top-down movement between obstacles feels right.
- Static bodies MUST call `refreshBody()` after `setDisplaySize()`.
- Asset pipeline: drop AI-generated character art as `assets/<name>.jpg`, run
  `node scripts/remove_bg.js` (ML background removal + auto-trim to square
  bounding box) to produce `assets/<name>.png`. Background scenes are excluded
  by filename — the script must skip any `*_bg.jpg`, not just `classroom_bg.jpg`.
- Coordinate system: canvas is 800x600; background source art is 1376x768
  displayed at 800x600 (map image coords with x*0.5814, y*0.78125).
- Cache busting: bump `?v=` query strings in `index.html` and `preload()`.

## Level 2 contents

| Element | Detail |
|---|---|
| Background | `assets/schoolyard_bg.jpg` — pixel-art schoolyard: school wall + door at top, playground equipment (slide/swings), trees, fence around the edges, gate at bottom center |
| NPC | **Coach** (`assets/coach.jpg` -> `coach.png`), stands near the equipment; gives the pep talk that unlocks puzzles (mirrors the Pokedex gate in Level 1) |
| Pokemon 4 | `Pika-spark` (electric) — puzzle `maze` |
| Pokemon 5 | `Psy-duckling` (psychic) — puzzle `whack` |
| Pokemon 6 | `Flutter-bird` (flying) — puzzle `rhythm` |
| Entrance | Player fades in at the top, just below the school door (returning to Level 1 is not required) |
| Exit | School gate at bottom center; blocked with a Coach dialogue until all 3 are caught, then fades to the final graduation ending screen |

### New puzzle mechanics (action mini-games, harder than Level 1)

(Originally circuit/slider/catch; replaced with action mini-games by request.)

- **`maze` (Pika-spark)** — steady-hand game: pick up the spark by hovering
  its start cell, then trace the mouse through a serpentine wire maze to the
  bulb. Touching a wall zaps the spark back to the start (no fail-out).
- **`whack` (Psy-duckling)** — whack-a-duckling: the Pokemon pops out of one
  of 9 holes (~0.9s each); bop it 8 times within 25 seconds. Timer expiry
  fails; uses the Pokemon's own sprite art for the pop-up face.
- **`rhythm` (Flutter-bird)** — beat matching: rings shrink onto a drum
  (1.5s each, 6 total); tap the drum inside a ±220ms window around the
  moment the ring closes. 4 hits out of 6 wins. Click grading uses
  `performance.now()` so dropped frames never punish the player. All timers
  and the rAF loop are torn down in `puzzleCleanup`.

## Architecture decisions for the refactor

- Convert `src/game.js` to two scene classes: `ClassroomScene` and
  `SchoolyardScene`, sharing helpers (player factory with feet hitbox,
  shadow/hint creation, exit-zone check, NPC creation with `refreshBody`).
  Keep everything in `src/game.js` unless splitting files, in which case use
  plain `<script>` tags in dependency order (no bundler in this project).
- Cross-level state moves to the Phaser registry (`hasPokedex`,
  `caughtCount` global 0..6); per-scene arrays keep sprite references.
- The dialogue/puzzle HTML overlay code stays global (it already is);
  `showPuzzle` dispatch gains the three new `puzzleType` values.
- Level 1 behavior must not change (regression-test it after the refactor).

## Art dependency

Subagents cannot generate AI art. Whoever owns an art-dependent task should
build against **placeholder assets** (solid-color or programmatically drawn
shapes at the right dimensions, 1376x768 for the background, ~1024x1024 for
characters) and document exactly which files to replace. The project owner
generates the real AI art in the established style and re-runs
`node scripts/remove_bg.js`.

## Task breakdown (see session task list)

1. **Multi-scene refactor** (foundation — blocks most other work)
2. **Schoolyard background + collision layout** (art-dependent, placeholder OK)
3. **Level 2 characters: Coach + 3 Pokemon wiring** (art-dependent)
4. **Puzzle: `circuit`** (independent — DOM contract only)
5. **Puzzle: `slider`** (independent — DOM contract only)
6. **Puzzle: `catch`** (independent — DOM contract only)
7. **Progression & polish**: classroom exit -> Level 2 transition, level title
   cards, Pokedex HUD counter (n/6), gate ending + Play Again
8. **End-to-end verification** of both levels (blocked by all of the above)

Tasks 4-6 only depend on the puzzle DOM contract above, so they can run in
parallel with the refactor as long as they don't touch scene code — each
delivers a `setupXxxPuzzle` function, its CSS, and a manual test path.
