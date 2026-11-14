/**
 * 음성 안내 (Web Speech API, ko-KR).
 * 지원하지 않는 브라우저에서는 조용히 생략한다.
 */

export interface SpeakHooks {
  onStart?: () => void;
  onEnd?: () => void;
}

export function isVoiceSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function pickKoreanVoice(): SpeechSynthesisVoice | null {
  if (!isVoiceSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => voice.lang?.toLowerCase().startsWith('ko')) ?? null;
}

export function speak(text: string, hooks: SpeakHooks = {}): void {
  if (!isVoiceSupported() || !text) {
    hooks.onEnd?.();
    return;
  }

  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 0.95;
    utterance.pitch = 1;
    const voice = pickKoreanVoice();
    if (voice) utterance.voice = voice;

    let ended = false;
    const finish = (): void => {
      if (ended) return;
      ended = true;
      hooks.onEnd?.();
    };

    utterance.onstart = () => hooks.onStart?.();
    utterance.onend = finish;
    utterance.onerror = finish;
    synth.speak(utterance);
  } catch {
    hooks.onEnd?.();
  }
}

export function cancelVoice(): void {
  if (!isVoiceSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // 무시
  }
}
