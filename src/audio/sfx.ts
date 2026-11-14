let sharedContext: AudioContext | null = null;

function resolveContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedContext) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    sharedContext = new Ctor();
  }
  if (sharedContext.state === 'suspended') {
    void sharedContext.resume().catch(() => undefined);
  }
  return sharedContext;
}

export function setSfxContext(context: AudioContext | null): void {
  sharedContext = context;
}

export function disposeSfx(): void {
  if (sharedContext) {
    void sharedContext.close().catch(() => undefined);
    sharedContext = null;
  }
}

/** 동작 전환 종소리 (맑은 2음) */
export function playChime(context?: AudioContext | null): void {
  const ctx = context ?? resolveContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  [659.25, 880.0].forEach((frequency, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    const start = now + index * 0.12;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.14, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 1.2);
  });
}

/** 정확 상태 진입 "딩" */
export function playDing(context?: AudioContext | null): void {
  const ctx = context ?? resolveContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 1046.5;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.12, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 1);
}

/** 세션 종료음 */
export function playComplete(context?: AudioContext | null): void {
  const ctx = context ?? resolveContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  [523.25, 659.25, 783.99].forEach((frequency, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    const start = now + index * 0.16;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.1, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 1.3);
  });
}
