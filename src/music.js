// Lightweight procedural chiptune background music using the Web Audio API.
// No audio files or generation service — each track is a note-name pattern
// played through oscillators with a classic lookahead scheduler, so timing
// stays sample-accurate even if the browser tab stutters.
const Music = (() => {
    const SEMITONES = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

    function noteToFreq(note) {
        if (!note) return null;
        const [, letter, octaveStr] = note.match(/^([A-G]#?)(\d)$/);
        const midi = (parseInt(octaveStr, 10) + 1) * 12 + SEMITONES[letter];
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    // Each pattern is 16 eighth-note steps; null = rest
    const TRACKS = {
        classroom: {
            volume: 2.5,
            tempo: 92,
            leadWave: 'triangle',
            bassWave: 'sine',
            lead: ['C4', 'E4', 'G4', 'E4', 'D4', 'F4', 'A4', 'F4', 'E4', 'G4', 'C5', 'G4', 'D4', 'F4', 'A4', null],
            bass: ['C3', null, null, null, 'F3', null, null, null, 'G3', null, null, null, 'C3', null, null, null]
        },
        schoolyard: {
            tempo: 148,
            leadWave: 'square',
            bassWave: 'triangle',
            lead: ['C4', 'D4', 'E4', 'G4', 'E4', 'G4', 'A4', 'G4', 'C5', 'G4', 'E4', 'G4', 'A4', 'G4', 'E4', 'D4'],
            bass: ['C3', 'C3', 'G3', 'G3', 'C3', 'C3', 'G3', 'G3', 'F3', 'F3', 'C4', 'C4', 'G3', 'G3', 'C3', 'C3']
        },
        // Triumphant fanfare for the graduation ending screen
        victory: {
            volume: 1.3,
            tempo: 132,
            leadWave: 'square',
            bassWave: 'triangle',
            lead: ['C5', 'C5', 'C5', 'E5', null, 'D5', 'D5', 'F5', 'E5', 'C5', 'E5', 'G5', 'C6', null, 'G5', 'C6'],
            bass: ['C3', null, 'G3', null, 'F3', null, 'G3', null, 'C3', null, 'F3', null, 'G3', 'G3', 'C4', null]
        }
    };

    const LOOKAHEAD_MS = 25;
    const SCHEDULE_AHEAD = 0.12;
    const VOLUME = 0.5;

    let ctx = null;
    let masterGain = null;
    let unlocked = false;
    let muted = false;
    let pendingTrack = null;
    let currentTrackName = null;
    let step = 0;
    let nextNoteTime = 0;
    let timerId = null;

    function scheduleNote(freq, wave, time, duration, peakGain) {
        if (!freq) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = wave;
        osc.frequency.value = freq;
        // Short pluck envelope so notes don't click or drone into each other
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(peakGain, time + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(time);
        osc.stop(time + duration + 0.02);
    }

    function scheduler() {
        const track = TRACKS[currentTrackName];
        if (!track) return;
        const stepDuration = 60 / track.tempo / 2; // eighth notes
        const vol = track.volume || 1.0;
        while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
            const i = step % track.lead.length;
            scheduleNote(noteToFreq(track.lead[i]), track.leadWave, nextNoteTime, stepDuration * 0.9, 0.09 * vol);
            scheduleNote(noteToFreq(track.bass[i]), track.bassWave, nextNoteTime, stepDuration * 1.8, 0.07 * vol);
            nextNoteTime += stepDuration;
            step++;
        }
    }

    function startTrack(name) {
        currentTrackName = name;
        step = 0;
        nextNoteTime = ctx.currentTime + 0.05;
        clearInterval(timerId);
        timerId = setInterval(scheduler, LOOKAHEAD_MS);
    }

    // ---- Short synthesized sound effects (share the music's context and
    // master gain, so the mute button silences them too). Safe no-ops until
    // the first user gesture creates the context. ----
    function playTone(freq, duration, wave, peak, delay = 0, slideTo = null) {
        if (!ctx || !masterGain) return;
        const t0 = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = wave;
        osc.frequency.setValueAtTime(freq, t0);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(peak, t0 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t0);
        osc.stop(t0 + duration + 0.02);
    }

    const SFX = {
        // Rising two-note chime for solving a puzzle
        ding() { playTone(987.77, 0.12, 'triangle', 0.2); playTone(1318.51, 0.35, 'triangle', 0.2, 0.09); },
        // Sad descending buzz for getting it wrong
        wrong() { playTone(196, 0.28, 'square', 0.1); playTone(147, 0.35, 'square', 0.1, 0.12); },
        // Electric zap: two detuned falling sawtooths
        zap() { playTone(520, 0.2, 'sawtooth', 0.14, 0, 60); playTone(480, 0.2, 'sawtooth', 0.1, 0.02, 55); },
        // Quick rising pop for bopping something
        pop() { playTone(300, 0.1, 'square', 0.14, 0, 620); },
        // Drum thump: fast falling sine like a kick
        thump() { playTone(165, 0.18, 'sine', 0.3, 0, 55); },
        // Tiny click for flipping a card
        click() { playTone(700, 0.06, 'triangle', 0.12); }
    };

    function unlock() {
        if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = ctx.createGain();
            masterGain.gain.value = muted ? 0 : VOLUME;
            masterGain.connect(ctx.destination);
        }
        if (unlocked) return;
        // iOS only grants audio inside certain gestures (touchend/click, not
        // touchstart), and a failed resume leaves the context 'suspended'
        // forever - so retry on every gesture until it actually runs, then
        // restart the queued track from the top
        const finish = () => {
            if (unlocked || ctx.state !== 'running') return;
            unlocked = true;
            UNLOCK_EVENTS.forEach(ev => window.removeEventListener(ev, unlock));
            const track = pendingTrack || currentTrackName;
            if (track) startTrack(track);
        };
        if (ctx.state === 'suspended') {
            ctx.resume().then(finish).catch(() => {});
        } else {
            finish();
        }
    }

    // Browsers block audio until a user gesture. Listen to both the start and
    // end of presses: pointerdown suffices on desktop, but iOS Safari needs a
    // completed gesture (touchend/pointerup/click) before resume() succeeds.
    const UNLOCK_EVENTS = ['keydown', 'pointerdown', 'pointerup', 'touchend', 'click'];
    UNLOCK_EVENTS.forEach(ev => window.addEventListener(ev, unlock));

    return {
        setTrack(name) {
            if (name === currentTrackName && unlocked) return;
            if (!unlocked) { pendingTrack = name; return; }
            startTrack(name);
        },
        toggleMute() {
            muted = !muted;
            if (masterGain) masterGain.gain.value = muted ? 0 : VOLUME;
            return muted;
        },
        isMuted() {
            return muted;
        },
        currentTrack() {
            return currentTrackName;
        },
        // Play one pitched note (used by the Simon pads); no-op before unlock
        tone(freq, duration = 0.25, wave = 'triangle', peak = 0.18) {
            playTone(freq, duration, wave, peak);
        },
        // Play a named effect from the SFX table; no-op before unlock
        sfx(name) {
            if (SFX[name]) SFX[name]();
        }
    };
})();
