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
            volume: 1.5,
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

    function unlock() {
        if (unlocked) return;
        unlocked = true;
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        masterGain = ctx.createGain();
        masterGain.gain.value = muted ? 0 : VOLUME;
        masterGain.connect(ctx.destination);
        if (pendingTrack) startTrack(pendingTrack);
    }

    // Browsers block audio until a user gesture; the game already requires
    // keyboard input to move, so the first key press or click unlocks it
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('pointerdown', unlock, { once: true });

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
        }
    };
})();
