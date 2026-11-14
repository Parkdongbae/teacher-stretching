/** Canva 로 만든 배경 이미지 (public/images/bg-1.jpg ~ bg-5.jpg) */
export const BACKGROUND_COUNT = 5;

const LAST_KEY = 'stretching.background.last';

/**
 * 접속할 때마다 배경을 무작위로 고른다.
 * 직전에 본 배경은 피해서, 새로 열 때마다 바뀐 것이 느껴지게 한다.
 */
export function pickBackgroundIndex(
  count: number = BACKGROUND_COUNT,
  last: number | null = null,
  random: () => number = Math.random,
): number {
  if (count <= 1) return 1;
  const candidates: number[] = [];
  for (let index = 1; index <= count; index += 1) {
    if (index !== last) candidates.push(index);
  }
  return candidates[Math.floor(random() * candidates.length)] ?? 1;
}

export function applyRandomBackground(): void {
  if (typeof document === 'undefined') return;
  let last: number | null = null;
  try {
    const raw = Number(window.localStorage.getItem(LAST_KEY));
    last = Number.isInteger(raw) && raw >= 1 ? raw : null;
  } catch {
    last = null;
  }

  const index = pickBackgroundIndex(BACKGROUND_COUNT, last);
  document.documentElement.style.setProperty('--bg-image', `url('/images/bg-${index}.jpg')`);

  try {
    window.localStorage.setItem(LAST_KEY, String(index));
  } catch {
    // 저장할 수 없는 환경에서는 그냥 넘어간다.
  }
}
