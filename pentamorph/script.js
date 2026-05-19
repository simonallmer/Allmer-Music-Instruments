// Pentamorph v2.0 - Dual Sphere Interface

let synth;
let kickSynth;
let currentPercSynth;
let isAudioContextStarted = false;
let currentOctave = 4;
const minOctave = 1;
const maxOctave = 6;

// Beat / Transport Logic
let beatSynthLow, beatSynthHigh, beatNoise;
let beatSequence;
let isSpaceHeld = false;
let isAutoBeatsActive = false;
let autoBeatSynth, urbanArpSynth, glitchSynth;
let melodicPattern = [];
let patternStep = 0;
let lastScaleIndex = -1;

// Sound Banks
let currentNoteBankIndex = 0;
let currentPercBankIndex = 0;

const noteBanks = [
    { name: "SPHERE",  type: "sine3",    envelope: { attack: 0.01, decay: 0.5,  sustain: 0.1, release: 1.5 } },
    { name: "CRYSTAL", type: "triangle", envelope: { attack: 0.05, decay: 0.3,  sustain: 0.4, release: 2   } },
    { name: "SAW",     type: "sawtooth", envelope: { attack: 0.01, decay: 0.2,  sustain: 0.1, release: 1   } },
    { name: "PAD",     type: "pwm",      envelope: { attack: 0.5,  decay: 0.5,  sustain: 0.7, release: 3   } }
];

const percBanks = [
    {
        name: "KICK",
        create: () => new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 4, oscillator: { type: "sine" },   envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 } }).toDestination(),
        note: "C1", duration: "8n"
    },
    {
        name: "TOM",
        create: () => new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 2, oscillator: { type: "sine" },   envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 } }).toDestination(),
        note: "A2", duration: "8n"
    },
    {
        name: "SNARISH",
        create: () => new Tone.MembraneSynth({ pitchDecay: 0.01, octaves: 6, oscillator: { type: "square" }, envelope: { attack: 0.001, decay: 0.2, sustain: 0.01, release: 0.2 } }).toDestination(),
        note: "G2", duration: "16n"
    },
    {
        name: "ZAP",
        create: () => new Tone.MembraneSynth({ pitchDecay: 0.1, octaves: 8,  oscillator: { type: "triangle" }, envelope: { attack: 0.001, decay: 0.1, sustain: 0.01, release: 0.1 } }).toDestination(),
        note: "C4", duration: "32n"
    }
];

const keyMap = {
    'a': { index: 0, controller: 'left' },
    's': { index: 1, controller: 'left' },
    'd': { index: 2, controller: 'left' },
    'f': { index: 3, controller: 'left' },
    'c': { index: 4, controller: 'left' },
    'b': { index: 0, controller: 'right' },
    'g': { index: 1, controller: 'right' },
    'h': { index: 2, controller: 'right' },
    'j': { index: 3, controller: 'right' },
    'k': { index: 4, controller: 'right' }
};

const scales = [
    { name: "MAJOR",    notes: ['C', 'D', 'E', 'G', 'A'] },
    { name: "MINOR",    notes: ['C', 'Eb', 'F', 'G', 'Bb'] },
    { name: "JAPANESE", notes: ['C', 'Db', 'F', 'G', 'Ab'] }
];
let currentScaleIndex = 0;

// Portrait sphere state
let currentPortraitSphere = 'left';

// Swipe detection
let swipeTouchStartX = 0;
let swipeTouchOnNode = false;

// Beat button toggle state (for mobile)
let beatManuallyToggled = false;


document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    const overlay = document.getElementById('start-overlay');

    startBtn.addEventListener('click', async () => {
        await initAudio();
        overlay.classList.add('hidden');
    });

    // Controls modal
    const controlsBtn = document.getElementById('controls-btn');
    const controlsOverlay = document.getElementById('controls-overlay');
    const closeControlsBtn = document.getElementById('close-controls');

    function openControls() { controlsOverlay.classList.remove('hidden'); }
    function closeControls() { controlsOverlay.classList.add('hidden'); }

    if (controlsBtn)      controlsBtn.addEventListener('click', openControls);
    if (closeControlsBtn) closeControlsBtn.addEventListener('click', closeControls);
    if (controlsOverlay)  controlsOverlay.addEventListener('click', e => { if (e.target === controlsOverlay) closeControls(); });

    // Morph button (header)
    const morphBtn = document.getElementById('morph-btn');
    if (morphBtn) morphBtn.addEventListener('click', () => handleMorph());

    // Logo → return to start
    const logoHome = document.getElementById('logo-home');
    if (logoHome) logoHome.addEventListener('click', () => overlay.classList.remove('hidden'));

    // BPM input
    const bpmInput = document.getElementById('bpm-input');
    if (bpmInput) {
        bpmInput.addEventListener('change', e => {
            const val = parseInt(e.target.value);
            if (val > 0 && isAudioContextStarted) Tone.Transport.bpm.rampTo(val, 0.1);
        });
        bpmInput.addEventListener('keydown', e => {
            e.stopPropagation();
            if (e.key === 'Enter') bpmInput.blur();
        });
    }

    // BPM +/- touch buttons
    const bpmDown = document.getElementById('bpm-down');
    const bpmUp   = document.getElementById('bpm-up');
    if (bpmDown) bpmDown.addEventListener('click', () => adjustBPM(-5));
    if (bpmUp)   bpmUp.addEventListener('click',   () => adjustBPM(5));

    // Auto beats (header)
    const autoBeatsBtn = document.getElementById('auto-beats-btn');
    if (autoBeatsBtn) autoBeatsBtn.addEventListener('click', () => toggleAutoBeats());

    // ---- TAPPABLE STATUS ITEMS ----
    const statusMorph = document.getElementById('status-morph');
    if (statusMorph) {
        statusMorph.addEventListener('click', () => {
            if (!isAudioContextStarted) return;
            handleMorph();
        });
    }

    const statusNoteBank = document.getElementById('status-note-bank');
    if (statusNoteBank) {
        statusNoteBank.addEventListener('click', () => {
            if (!isAudioContextStarted) return;
            currentNoteBankIndex = (currentNoteBankIndex + 1) % noteBanks.length;
            updateNoteSynth();
        });
    }

    const statusPercBank = document.getElementById('status-perc-bank');
    if (statusPercBank) {
        statusPercBank.addEventListener('click', () => {
            if (!isAudioContextStarted) return;
            currentPercBankIndex = (currentPercBankIndex + 1) % percBanks.length;
            updatePercSynth();
        });
    }

    // Octave inline +/- in status bar
    const octaveStatusDown = document.getElementById('octave-status-down');
    const octaveStatusUp   = document.getElementById('octave-status-up');
    if (octaveStatusDown) {
        octaveStatusDown.addEventListener('click', e => {
            e.stopPropagation();
            handleOctaveChange('-');
        });
    }
    if (octaveStatusUp) {
        octaveStatusUp.addEventListener('click', e => {
            e.stopPropagation();
            handleOctaveChange('+');
        });
    }

    // ---- MOBILE TOOLBAR ----

    // BEAT toggle button (manual beat loop — independent of Auto Beats)
    const beatBtn = document.getElementById('beat-btn');
    if (beatBtn) {
        beatBtn.addEventListener('click', () => {
            if (!isAudioContextStarted) return;
            beatManuallyToggled = !beatManuallyToggled;
            if (beatManuallyToggled) {
                Tone.Transport.start();
                beatBtn.classList.add('active');
            } else {
                // Only stop transport if auto beats also not running
                if (!isAutoBeatsActive) Tone.Transport.stop();
                isSpaceHeld = false;
                beatBtn.classList.remove('active');
            }
        });
    }

    // SWITCH sphere button (portrait)
    const switchBtn = document.getElementById('switch-sphere-btn');
    if (switchBtn) switchBtn.addEventListener('click', () => switchPortraitSphere());

    // AUTO beats (toolbar)
    const mobileAutoBtn = document.getElementById('mobile-auto-btn');
    if (mobileAutoBtn) mobileAutoBtn.addEventListener('click', () => toggleAutoBeats());

    // MORPH (toolbar)
    const mobileMorphBtn = document.getElementById('mobile-morph-btn');
    if (mobileMorphBtn) mobileMorphBtn.addEventListener('click', () => {
        if (!isAudioContextStarted) return;
        handleMorph();
    });

    // MENU (toolbar) → toggles header controls / opens controls modal
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const hamburgerBtn  = document.getElementById('hamburger-btn');
    const headerControls = document.getElementById('header-controls');

    function toggleMobileMenu() {
        if (headerControls) {
            headerControls.classList.toggle('open');
            const isOpen = headerControls.classList.contains('open');
            if (mobileMenuBtn) mobileMenuBtn.classList.toggle('active', isOpen);
            if (hamburgerBtn) hamburgerBtn.classList.toggle('active', isOpen);
        }
    }
    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    if (hamburgerBtn)  hamburgerBtn.addEventListener('click', toggleMobileMenu);

    // Sphere indicator dots
    const sphereDots = document.querySelectorAll('.sphere-dot');
    sphereDots.forEach(dot => {
        dot.addEventListener('click', () => {
            const target = dot.dataset.controller;
            if (target !== currentPortraitSphere) switchPortraitSphere();
        });
    });

    // ---- NOTE NODE TOUCH/MOUSE ----
    const nodes = document.querySelectorAll('.note-node');
    nodes.forEach(node => {
        const noteIndex  = parseInt(node.dataset.note);
        const controller = node.dataset.controller;

        const triggerStart = e => {
            e.preventDefault();
            playNote(noteIndex, controller);
            visualizeKey(noteIndex, true, controller);
        };
        const triggerEnd = e => {
            e.preventDefault();
            stopNote(noteIndex, controller);
            visualizeKey(noteIndex, false, controller);
        };
        const triggerLeave = () => {
            stopNote(noteIndex, controller);
            visualizeKey(noteIndex, false, controller);
        };

        node.addEventListener('mousedown',  triggerStart);
        node.addEventListener('mouseup',    triggerEnd);
        node.addEventListener('mouseleave', triggerLeave);
        node.addEventListener('touchstart', triggerStart, { passive: false });
        node.addEventListener('touchend',   triggerEnd,   { passive: false });
        node.addEventListener('touchcancel', triggerLeave);
    });

    // Octave side buttons (the big ± circles flanking sphere)
    const octaveBtns = document.querySelectorAll('.octave-btn');
    octaveBtns.forEach(btn => {
        const activate = () => {
            handleOctaveChange(btn.dataset.key);
            btn.classList.add('active');
            setTimeout(() => btn.classList.remove('active'), 150);
        };
        btn.addEventListener('mousedown', activate);
        btn.addEventListener('touchstart', e => { e.preventDefault(); activate(); }, { passive: false });
    });

    // ---- SWIPE TO SWITCH SPHERE ----
    document.addEventListener('touchstart', e => {
        swipeTouchStartX = e.touches[0].clientX;
        swipeTouchOnNode = !!e.target.closest('.note-node');
    }, { passive: true });

    document.addEventListener('touchend', e => {
        if (swipeTouchOnNode) return;
        const delta = e.changedTouches[0].clientX - swipeTouchStartX;
        const isPortrait = window.matchMedia('(orientation: portrait) and (max-width: 768px)').matches;
        if (isPortrait && Math.abs(delta) > 70) {
            switchPortraitSphere();
        }
    }, { passive: true });

    // ---- KEYBOARD ----
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup',   handleKeyUp);

    // Initial portrait sphere state
    initPortraitState();
});

// ---- PORTRAIT SPHERE SWITCHING ----
function initPortraitState() {
    const left  = document.getElementById('controller-left');
    const right = document.getElementById('controller-right');
    if (!left || !right) return;
    left.classList.add('portrait-active');
    right.classList.remove('portrait-active');
    currentPortraitSphere = 'left';
    updateSphereIndicator();
}

function switchPortraitSphere() {
    const left  = document.getElementById('controller-left');
    const right = document.getElementById('controller-right');
    if (!left || !right) return;

    if (currentPortraitSphere === 'left') {
        left.classList.remove('portrait-active');
        right.classList.add('portrait-active');
        currentPortraitSphere = 'right';
    } else {
        right.classList.remove('portrait-active');
        left.classList.add('portrait-active');
        currentPortraitSphere = 'left';
    }
    updateSphereIndicator();

    // Pulse feedback
    const activeSphere = document.getElementById(
        currentPortraitSphere === 'left' ? 'controller-left' : 'controller-right'
    );
    if (activeSphere) {
        activeSphere.style.transform = 'scale(0.97)';
        setTimeout(() => { activeSphere.style.transform = ''; }, 150);
    }
}

function updateSphereIndicator() {
    document.querySelectorAll('.sphere-dot').forEach(dot => {
        dot.classList.toggle('active', dot.dataset.controller === currentPortraitSphere);
    });
    const switchBtn = document.getElementById('switch-sphere-btn');
    if (switchBtn) {
        const label = switchBtn.querySelector('.tool-label');
        if (label) label.textContent = currentPortraitSphere === 'left' ? 'LEFT' : 'RIGHT';
    }
}

// ---- BPM ADJUSTMENT ----
function adjustBPM(delta) {
    const input = document.getElementById('bpm-input');
    if (!input) return;
    let val = parseInt(input.value) + delta;
    val = Math.max(40, Math.min(300, val));
    input.value = val;
    if (isAudioContextStarted) Tone.Transport.bpm.rampTo(val, 0.1);
}

// ---- MORPH ----
function handleMorph() {
    if (!isAudioContextStarted) return;
    currentScaleIndex = (currentScaleIndex + 1) % scales.length;
    const activeScale = scales[currentScaleIndex];
    document.getElementById('morph-display').innerText = activeScale.name;
    document.body.classList.add('morph-glow');
    setTimeout(() => document.body.classList.remove('morph-glow'), 500);
    if (currentPercSynth) currentPercSynth.triggerAttackRelease("C5", "32n", undefined, 0.1);
}

// ---- INIT AUDIO ----
async function initAudio() {
    if (isAudioContextStarted) return;
    await Tone.start();
    updateNoteSynth();
    updatePercSynth();

    const reverb = new Tone.Reverb({ decay: 6, wet: 0.4 }).toDestination();
    const delay  = new Tone.PingPongDelay("4n", 0.2).toDestination();
    synth.connect(reverb);
    synth.connect(delay);
    synth.volume.value = -5;

    autoBeatSynth = new Tone.MonoSynth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.05, decay: 0.3, sustain: 0.2, release: 1.2 },
        filter: { Q: 1, type: "lowpass", rolloff: -12 },
        filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 1, baseFrequency: 200, octaves: 4, exponent: 2 },
        volume: -10
    }).toDestination();
    autoBeatSynth.connect(reverb);

    urbanArpSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 },
        volume: -15
    }).toDestination();
    urbanArpSynth.connect(delay);

    glitchSynth = new Tone.NoiseSynth({
        noise: { type: "white" },
        filter: { Q: 10, type: "bandpass", rolloff: -48 },
        envelope: { attack: 0.001, decay: 0.01, sustain: 0 },
        volume: -20
    }).toDestination();
    glitchSynth.connect(reverb);

    beatSynthLow = new Tone.MembraneSynth({
        pitchDecay: 0.05, octaves: 10, oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 }, volume: 6
    }).toDestination();
    beatSynthLow.connect(reverb);

    beatSynthHigh = new Tone.MembraneSynth({
        pitchDecay: 0.02, octaves: 2, oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 }, volume: -5
    }).toDestination();
    beatSynthHigh.connect(reverb);

    beatNoise = new Tone.NoiseSynth({
        noise: { type: "pink" },
        filter: { Q: 1, type: "highpass", rolloff: -12 },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0 }, volume: -18
    }).toDestination();

    beatSequence = new Tone.Sequence((time, step) => {
        if (isAutoBeatsActive) {
            if (currentScaleIndex !== lastScaleIndex) {
                melodicPattern = generateUrbanPattern();
                lastScaleIndex = currentScaleIndex;
            }

            if (step === 0 || step === 2) {
                beatSynthLow.triggerAttackRelease("C1", "8n", time);
                Tone.Draw.schedule(() => visualizeBeat(true), time);
            }

            const hiHatTime = time;
            if (step === 0 || step === 2) {
                beatSynthHigh.triggerAttackRelease("C8", "32n", hiHatTime, 0.4);
            } else if (step === 1) {
                const subDiv = Tone.Time("4n").toSeconds() / 4;
                for (let i = 0; i < 4; i++) {
                    beatSynthHigh.triggerAttackRelease("G7", "64n", hiHatTime + (i * subDiv), 0.2 - (i * 0.03));
                }
            } else if (step === 3) {
                beatSynthHigh.triggerAttackRelease("C8", "32n", hiHatTime, 0.5);
                beatSynthHigh.triggerAttackRelease("G7", "32n", hiHatTime + Tone.Time("8n").toSeconds(), 0.3);
            }

            if (step === 1 || step === 3) {
                currentPercSynth.triggerAttackRelease(percBanks[currentPercBankIndex].note, "16n", time, 0.7);
                beatNoise.triggerAttackRelease("16n", time, 0.5);
            }

            const motifNote = melodicPattern[patternStep % melodicPattern.length];
            if (motifNote) autoBeatSynth.triggerAttackRelease(`${motifNote}${currentOctave + 1}`, "16n", time);

            const arpSubDiv = Tone.Time("4n").toSeconds() / 4;
            const scaleNotes = scales[currentScaleIndex].notes;
            for (let i = 0; i < 4; i++) {
                if (Math.random() > 0.6) {
                    const arpNote = scaleNotes[Math.floor(Math.random() * scaleNotes.length)];
                    urbanArpSynth.triggerAttackRelease(`${arpNote}${currentOctave + 2}`, "32n", time + (i * arpSubDiv), 0.1 + Math.random() * 0.2);
                }
            }

            if ((step === 0 || step === 2) && Math.random() > 0.7) {
                glitchSynth.filter.frequency.value = 2000 + Math.random() * 5000;
                glitchSynth.triggerAttackRelease("64n", time + Math.random() * 0.1);
            }

            if (step === 3 && Math.random() > 0.5) {
                beatSynthLow.triggerAttackRelease("C0", "4n", time + Tone.Time("8n").toSeconds(), 0.3);
            }

            patternStep++;

        } else {
            if (step === 0) {
                beatSynthLow.triggerAttackRelease("C1", "8n", time);
                beatNoise.triggerAttackRelease("32n", time);
                Tone.Draw.schedule(() => visualizeBeat(true), time);
            } else if (step === 2) {
                beatSynthLow.triggerAttackRelease("E2", "16n", time, 0.4);
                Tone.Draw.schedule(() => visualizeBeat(false), time);
            } else {
                beatSynthHigh.triggerAttackRelease(step === 1 ? "G6" : "C7", "32n", time);
                beatNoise.triggerAttackRelease("64n", time, 0.2);
                Tone.Draw.schedule(() => visualizeBeat(false), time);
            }
        }
    }, [0, 1, 2, 3], "4n");

    beatSequence.start(0);
    Tone.Transport.bpm.value = parseInt(document.getElementById('bpm-input').value) || 120;
    isAudioContextStarted = true;
}

function updateNoteSynth() {
    const config = noteBanks[currentNoteBankIndex];
    if (synth) {
        synth.set({ oscillator: { type: config.type }, envelope: config.envelope });
    } else {
        synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: config.type },
            envelope: config.envelope,
            maxPolyphony: 64
        }).toDestination();
    }
    const el = document.getElementById('note-bank-display');
    if (el) {
        el.innerText = config.name;
        el.style.color = "#00f3ff";
        setTimeout(() => { el.style.color = ""; }, 300);
    }
}

function updatePercSynth() {
    const config = percBanks[currentPercBankIndex];
    if (currentPercSynth) currentPercSynth.dispose();
    currentPercSynth = config.create();
    currentPercSynth.volume.value = 0;

    if (isAudioContextStarted) {
        const oscType = currentPercSynth.oscillator ? currentPercSynth.oscillator.type : "sine";
        if (beatSynthLow)  beatSynthLow.oscillator.type  = oscType;
        if (beatSynthHigh) beatSynthHigh.oscillator.type = oscType;
    }

    const el = document.getElementById('perc-bank-display');
    if (el) {
        el.innerText = config.name;
        el.style.color = "#bc13fe";
        setTimeout(() => { el.style.color = ""; }, 300);
    }
}

// ---- TOGGLE AUTO BEATS ----
function toggleAutoBeats() {
    if (!isAudioContextStarted) return;
    isAutoBeatsActive = !isAutoBeatsActive;

    const autoBtn       = document.getElementById('auto-beats-btn');
    const mobileAutoBtn = document.getElementById('mobile-auto-btn');
    const beatBtn       = document.getElementById('beat-btn');

    if (isAutoBeatsActive) {
        melodicPattern = generateUrbanPattern();
        patternStep = 0;
        Tone.Transport.start();
        if (autoBtn)       autoBtn.classList.add('active');
        if (mobileAutoBtn) mobileAutoBtn.classList.add('active');
    } else {
        if (!isSpaceHeld && !beatManuallyToggled) Tone.Transport.stop();
        if (autoBtn)       autoBtn.classList.remove('active');
        if (mobileAutoBtn) mobileAutoBtn.classList.remove('active');
    }
}

function generateUrbanPattern() {
    const scale = scales[currentScaleIndex];
    const notes = scale.notes;
    const pattern = [];
    for (let i = 0; i < 8; i++) {
        if (Math.random() > 0.4) {
            let noteIdx;
            if (scale.name === "JAPANESE") {
                noteIdx = Math.random() > 0.6 ? 1 : (Math.random() > 0.5 ? 2 : 0);
            } else if (scale.name === "MINOR") {
                noteIdx = [0, 1, 4][Math.floor(Math.random() * 3)];
            } else {
                noteIdx = Math.floor(Math.random() * notes.length);
            }
            pattern.push(notes[noteIdx]);
        } else {
            pattern.push(null);
        }
    }
    return pattern;
}

// ---- KEYBOARD HANDLERS ----
function handleKeyDown(e) {
    if (e.target.tagName === 'INPUT') return;
    if (e.repeat) return;
    const key = e.key.toLowerCase();

    if (e.key === "ArrowUp") {
        currentNoteBankIndex = (currentNoteBankIndex + 1) % noteBanks.length;
        updateNoteSynth(); return;
    } else if (e.key === "ArrowDown") {
        currentNoteBankIndex = (currentNoteBankIndex - 1 + noteBanks.length) % noteBanks.length;
        updateNoteSynth(); return;
    } else if (e.key === "ArrowRight") {
        currentPercBankIndex = (currentPercBankIndex + 1) % percBanks.length;
        updatePercSynth(); return;
    } else if (e.key === "ArrowLeft") {
        currentPercBankIndex = (currentPercBankIndex - 1 + percBanks.length) % percBanks.length;
        updatePercSynth(); return;
    }

    if (key in keyMap) {
        const { index, controller } = keyMap[key];
        playNote(index, controller);
        visualizeKey(index, true, controller);
        return;
    }

    if (e.key === 'Escape') {
        const overlay = document.getElementById('start-overlay');
        if (!overlay.classList.contains('hidden')) {
            // ESC on landing page → go back to SA
            window.location.href = 'https://simonallmer.com';
        } else {
            // ESC on play screen → show landing page
            overlay.classList.remove('hidden');
        }
        return;
    }

    if (key === '-' || key === '_') {
        handleOctaveChange('-');
        visualizeOctaveControl('-', true);
    } else if (key === '+' || key === '=') {
        handleOctaveChange('+');
        visualizeOctaveControl('+', true);
    } else if (e.code === 'Enter') {
        handleMorph();
    } else if (key === 't') {
        toggleAutoBeats();
    } else if (e.code === 'Space') {
        if (!isSpaceHeld && isAudioContextStarted) {
            Tone.Transport.start();
            isSpaceHeld = true;
            const beatBtn = document.getElementById('beat-btn');
            if (beatBtn) beatBtn.classList.add('active');
        }
    }
}

function handleKeyUp(e) {
    if (e.target.tagName === 'INPUT') return;
    const key = e.key.toLowerCase();

    if (key in keyMap) {
        const { index, controller } = keyMap[key];
        stopNote(index, controller);
        visualizeKey(index, false, controller);
    }

    if (key === '-' || key === '_') {
        visualizeOctaveControl('-', false);
    } else if (key === '+' || key === '=') {
        visualizeOctaveControl('+', false);
    } else if (e.code === 'Space') {
        if (isAudioContextStarted) {
            isSpaceHeld = false;
            if (!isAutoBeatsActive && !beatManuallyToggled) {
                Tone.Transport.stop();
                const beatBtn = document.getElementById('beat-btn');
                if (beatBtn) beatBtn.classList.remove('active');
            }
        }
    }
}

// ---- AUDIO HELPERS ----
function getNoteName(index, controller) {
    const note = scales[currentScaleIndex].notes[index];
    const octave = controller === 'right' ? currentOctave + 1 : currentOctave;
    return `${note}${octave}`;
}

function playNote(index, controller) {
    if (!synth || !isAudioContextStarted) return;
    synth.triggerAttack(getNoteName(index, controller));
}

function stopNote(index, controller) {
    if (!synth || !isAudioContextStarted) return;
    synth.triggerRelease(getNoteName(index, controller));
}

function playPercussion() {
    if (!currentPercSynth || !isAudioContextStarted) return;
    const config = percBanks[currentPercBankIndex];
    currentPercSynth.triggerAttackRelease(config.note, config.duration);
}

function handleOctaveChange(direction) {
    if (direction === '+' && currentOctave < maxOctave) {
        currentOctave++;
        animateOctaveDisplay("UP");
    } else if (direction === '-' && currentOctave > minOctave) {
        currentOctave--;
        animateOctaveDisplay("DOWN");
    }
    updateOctaveDisplay();
}

function updateOctaveDisplay() {
    const el = document.getElementById('octave-display');
    if (el) el.innerText = currentOctave;
}

function animateOctaveDisplay(dir) {
    const el = document.getElementById('octave-display');
    if (!el) return;
    el.style.color     = dir === "UP" ? "#fff" : "#ff0055";
    el.style.transform = dir === "UP" ? "translateY(-4px)" : "translateY(4px)";
    setTimeout(() => { el.style.color = ""; el.style.transform = ""; }, 200);
}

// ---- VISUALIZE ----
function visualizeBeat(isStrong) {
    document.querySelectorAll('.core-node').forEach(core => {
        const cls = isStrong ? 'kick-pulse' : 'pulse';
        core.classList.add(cls);
        setTimeout(() => core.classList.remove(cls), isStrong ? 150 : 100);
    });
}

function visualizeKey(index, isActive, controller) {
    const nodeEl = document.querySelector(`.note-node[data-note="${index}"][data-controller="${controller}"]`);
    if (nodeEl) nodeEl.classList.toggle('active', isActive);

    const core = document.getElementById(controller === 'left' ? 'core-left' : 'core-right');
    if (core) {
        if (isActive) {
            core.classList.add('pulse');
        } else {
            const anyActive = document.querySelectorAll(`.note-node[data-controller="${controller}"].active`).length > 0;
            if (!anyActive) core.classList.remove('pulse');
        }
    }
}

function visualizeOctaveControl(type, isActive) {
    const btn = document.querySelector(`.octave-btn[data-key="${type}"]`);
    if (btn) btn.classList.toggle('active', isActive);
}
