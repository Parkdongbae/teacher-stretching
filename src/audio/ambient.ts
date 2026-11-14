/**
 * 생성형 앰비언트 패드 (음원 파일 없음).
 * 사인/삼각파 4성부 + 로우패스 필터, 9초 간격 코드 진행, 3초 어택/릴리스.
 */

const CHORDS: number[][] = [
  // Cmaj7
  [130.81, 196.0, 246.94, 329.63],
  // Am7
  [110.0, 164.81, 220.0, 261.63],
  // Fmaj7
  [87.31, 130.81, 174.61, 220.0],
  // G6
  [98.0, 146.83, 196.0, 246.94],
];

const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0];
const CHORD_INTERVAL_SEC = 9;
const ATTACK_SEC = 3;
const RELEASE_SEC = 3;

type Timer = ReturnType<typeof setInterval>;

export interface AmbientHandle {
  readonly context: AudioContext | null;
  start(): Promise<void>;
  stop(): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  duck(active: boolean): void;
  dispose(): void;
}

export function ensureAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  return new Ctor();
}

export function createAmbient(): AmbientHandle {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let filter: BiquadFilterNode | null = null;
  let delay: DelayNode | null = null;
  let feedback: GainNode | null = null;
  let chordTimer: Timer | null = null;
  let active = false;
  let volume = 0.6;
  let muted = false;
  let ducked = false;
  let chordIndex = 0;

  const targetGain = (): number => {
    if (!active) return 0;
    const base = (volume / 100) * 0.22;
    return base * (muted ? 0 : 1) * (ducked ? 0.45 : 1);
  };

  const applyGain = (seconds = 0.35): void => {
    if (!context || !master) return;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(targetGain(), now, seconds / 3);
  };

  const playChord = (): void => {
    if (!context || !master) return;
    const chord = CHORDS[chordIndex % CHORDS.length];
    chordIndex += 1;
    const now = context.currentTime;
    // 다음 코드의 어택과 겹치도록 릴리스만큼 더 울려 끊김 없이 이어지게 한다.
    const end = now + CHORD_INTERVAL_SEC + RELEASE_SEC;

    chord.forEach((frequency, index) => {
      if (!context || !master) return;
      const gain = context.createGain();
      const peak = 0.09 / (index + 1);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(peak, now + ATTACK_SEC);
      gain.gain.setValueAtTime(peak, end - RELEASE_SEC);
      gain.gain.linearRampToValueAtTime(0.0001, end);
      gain.connect(filter ?? (master as GainNode));

      // 살짝 어긋난 두 음을 겹쳐 따뜻하고 넓은 패드 음색을 만든다.
      for (const detune of [-6, 6]) {
        const osc = context.createOscillator();
        osc.type = index % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.value = frequency * (index === 0 ? 1 : 2);
        osc.detune.value = detune;
        osc.connect(gain);
        osc.start(now);
        osc.stop(end + 0.1);
      }
    });

    if (chordIndex % 2 === 0) {
      scheduleBell(now + 4.5);
    }
  };

  const scheduleBell = (at: number): void => {
    if (!context || !master) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'sine';
    osc.frequency.value = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)] ?? 523.25;

    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(0.05, at + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 4);

    osc.connect(gain);
    if (delay) {
      gain.connect(delay);
    }
    gain.connect(filter ?? master);
    osc.start(at);
    osc.stop(at + 4.2);
  };

  const start = async (): Promise<void> => {
    if (!context) {
      context = ensureAudioContext();
      if (!context) return;
      master = context.createGain();
      master.gain.value = 0;
      filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1200;
      filter.Q.value = 0.4;
      delay = context.createDelay(1);
      delay.delayTime.value = 0.42;
      feedback = context.createGain();
      feedback.gain.value = 0.32;

      // 필터를 아주 느리게 여닫아 숨 쉬는 듯한 움직임을 준다.
      const lfo = context.createOscillator();
      const lfoGain = context.createGain();
      lfo.frequency.value = 0.05;
      lfoGain.gain.value = 350;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();

      filter.connect(master);
      master.connect(context.destination);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(master);
    }

    if (context.state === 'suspended') {
      await context.resume();
    }
    if (active) return;
    active = true;
    applyGain(2);
    chordIndex = 0;
    playChord();
    chordTimer = setInterval(playChord, CHORD_INTERVAL_SEC * 1000);
  };

  const stop = (): void => {
    if (!active) return;
    active = false;
    applyGain(2);
    if (chordTimer) {
      clearInterval(chordTimer);
      chordTimer = null;
    }
  };

  return {
    get context() {
      return context;
    },
    start,
    stop,
    setVolume(next: number) {
      volume = Math.min(100, Math.max(0, next));
      applyGain();
    },
    setMuted(next: boolean) {
      muted = next;
      applyGain();
    },
    duck(next: boolean) {
      ducked = next;
      applyGain(0.2);
    },
    dispose() {
      stop();
      if (chordTimer) {
        clearInterval(chordTimer);
        chordTimer = null;
      }
      if (context) {
        void context.close().catch(() => undefined);
      }
      context = null;
      master = null;
      filter = null;
      delay = null;
      feedback = null;
      active = false;
    },
  };
}
