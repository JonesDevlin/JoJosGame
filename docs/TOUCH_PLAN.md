# Touch / iPhone Support — Design & Task Plan

## Goal

Make the full game playable on a touch screen (iPhone Safari first): move the
player, talk to NPCs, solve all six puzzles, and finish both levels with no
keyboard or mouse.

## What already works with touch

- All dialogue/puzzle UI is plain HTML, so taps fire `click` handlers: the
  OK / Run Away / Play Again buttons, the music toggle, and five of the six
  puzzles (sequence pads, timing button, match cards, whack holes, rhythm
  drum) need no logic changes — only tap-target sizing checks.
- Audio unlock already listens for `pointerdown` (src/music.js), so music
  starts on the first tap.
- Asset paths in index.html are relative, so the site works from a
  GitHub Pages subpath unchanged.

## What breaks on touch today

1. **Movement** is arrow-keys only (`createCursorKeys` in src/game.js).
2. **Interact** is Spacebar only (also dismisses dialogue).
3. **Maze puzzle** uses `cell.onmouseenter` (src/game.js ~line 852) — finger
   drags do not fire per-element mouseenter, so the spark can't be traced.
4. **Screen fit**: the canvas is fixed 800x600 with no Scale Manager; on an
   iPhone the page overflows, double-tap zooms, and rubber-band scrolling
   fights the game.

## Tasks

### T1 — Responsive scaling + mobile page behavior (foundation)

- Switch the Phaser config to the Scale Manager: `scale: { mode:
  Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 800,
  height: 600 }` (remove top-level width/height). The game keeps its 800x600
  coordinate system; Phaser letterboxes it to the screen.
- HTML overlays: dialogue/puzzle/ending divs are body-level and sized in px.
  Make them responsive (`width: min(92vw, ...)`), keep them centered over the
  canvas, and verify at 375x812 (iPhone) in both orientations.
- Viewport meta: `width=device-width, initial-scale=1, maximum-scale=1,
  user-scalable=no, viewport-fit=cover` (blocks double-tap zoom, which
  otherwise fires during whack/rhythm rapid tapping).
- CSS: `touch-action: manipulation` globally (`none` on game surfaces),
  `overscroll-behavior: none`, `-webkit-user-select: none`, and
  `env(safe-area-inset-*)` padding for the HUD corners.
- Optional: a "rotate your phone" hint overlay in portrait, since 800x600
  fits landscape far better.

### T2 — Virtual touch controls (needs T1)

- On-screen D-pad (bottom-left) and an "A" interact button (bottom-right),
  as HTML overlay buttons shown only on touch devices (`@media (pointer:
  coarse)` plus a first-touch fallback check).
- Pointer events with multi-touch: hold a direction while tapping A (each
  button tracks its own pointerdown/up/cancel; `touch-action: none`).
- Input plumbing: a global `virtualInput = { up, down, left, right,
  interactPressed }`; `updatePlayerMovement` ORs it with the keyboard
  cursors, and the Space-interact checks in both scenes (and the dialogue
  dismiss in `overlayBlocking`) also consume `interactPressed` as an edge
  (set on tap, cleared after read) so one tap = one interaction.
- D-pad is 4-directional to match the game; ~56px buttons, semi-transparent.

### T3 — Maze puzzle touch tracing (independent)

- Replace per-cell `onmouseenter` with grid-level pointer handling:
  `pointerdown`/`pointermove` on `.maze-grid`, resolving the touched cell via
  `document.elementFromPoint(e.clientX, e.clientY)` — works identically for
  mouse hover-with-button-up by keeping the existing mouseenter path for
  fine pointers, or unifying both on pointermove.
- `touch-action: none` on the grid so tracing doesn't scroll the page.
- Bump cells from 28px to ~36px under `(pointer: coarse)` and widen
  `#puzzle-ui` to `min(92vw, 360px)` so a fingertip can trace the corridor.

### T4 — Tap-target and dialogue polish (needs T1)

- Audit tap targets to >=44px: match cards (55px OK), whack holes (60 OK),
  rhythm drum (70 OK), sequence pads (70 OK), timing catch button (OK),
  dialogue OK / Run Away buttons (bump padding).
- Let a tap anywhere on the dialogue box dismiss it (parity with Space).
- Make sure the bobbing "!" hint and HUD stay legible at phone scale.

### T5 — Deploy so an iPhone can reach it (independent)

- Enable GitHub Pages on the repo (main branch, root) — the game is a
  static site, so it becomes playable at
  `https://<user>.github.io/JoJosGame/` with zero build step.
- For same-Wi-Fi dev testing without deploying: run the existing
  `npx http-server -p 8123` and open `http://<PC-LAN-IP>:8123` on the phone.

### T6 — Mobile end-to-end verification (needs T1-T4)

- In the preview: resize to 375x812 and 812x375, drive everything with
  synthesized pointer events only (no keyboard): D-pad movement + collision,
  A-button interact/dismiss, all six puzzles including a full maze trace,
  both level transitions, gate ending, Play Again.
- Real-device pass (project owner, on iPhone): audio after first tap (note:
  iOS hardware silent switch can mute Web Audio — known caveat, not a bug),
  no page scroll/zoom, safe-area layout, multi-touch move+interact.

## Dependencies

T1 -> T2, T4, T6;  T3 and T5 independent;  T6 last.
T2 + T3 + T5 can run in parallel once T1 lands (T3/T5 even before).
