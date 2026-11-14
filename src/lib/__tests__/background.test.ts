import { describe, expect, it } from 'vitest';
import { BACKGROUND_COUNT, pickBackgroundIndex } from '../background';

describe('pickBackgroundIndex', () => {
  it('1~count 범위의 정수를 고른다', () => {
    for (let i = 0; i < 200; i += 1) {
      const index = pickBackgroundIndex();
      expect(Number.isInteger(index)).toBe(true);
      expect(index).toBeGreaterThanOrEqual(1);
      expect(index).toBeLessThanOrEqual(BACKGROUND_COUNT);
    }
  });

  it('직전에 본 배경은 다시 고르지 않는다', () => {
    for (let last = 1; last <= BACKGROUND_COUNT; last += 1) {
      for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
        expect(pickBackgroundIndex(BACKGROUND_COUNT, last, () => r)).not.toBe(last);
      }
    }
  });

  it('모든 배경이 선택될 수 있다', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 500; i += 1) seen.add(pickBackgroundIndex());
    expect(seen.size).toBe(BACKGROUND_COUNT);
  });
});
