import { describe, expect, it } from 'vitest';
import { LM } from '../geometry';
import { checkSetup, SETUP_HINTS, SETUP_RANGES } from '../setupCheck';
import type { Landmarks } from '../types';

type Patch = Record<number, [number, number]>;

const WELL_PLACED: Patch = {
  [LM.nose]: [0.5, 0.33],
  [LM.leftEar]: [0.57, 0.31],
  [LM.rightEar]: [0.43, 0.31],
  [LM.leftShoulder]: [0.62, 0.55],
  [LM.rightShoulder]: [0.38, 0.55],
};

function pose(patch: Patch, visibility = 0.99): Landmarks {
  const points: Landmarks = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility,
  }));
  for (const key of Object.keys(patch)) {
    const index = Number(key);
    const value = patch[index];
    points[index] = { x: value[0], y: value[1], visibility };
  }
  return points;
}

function modified(changes: Patch): Landmarks {
  return pose({ ...WELL_PLACED, ...changes });
}

describe('checkSetup', () => {
  it('권장 자세에서는 통과하고 안내 문구가 없다', () => {
    const result = checkSetup(pose(WELL_PLACED));
    expect(result.ok).toBe(true);
    expect(result.personVisible).toBe(true);
    expect(result.primaryHint).toBeNull();
    expect(result.conditions).toHaveLength(6);
    expect(result.conditions.every((condition) => condition.ok)).toBe(true);
  });

  it('사람이 보이지 않으면 첫 안내는 착석 안내', () => {
    const result = checkSetup(pose(WELL_PLACED, 0));
    expect(result.ok).toBe(false);
    expect(result.personVisible).toBe(false);
    expect(result.primaryHint).toBe(SETUP_HINTS.noPerson);
    expect(result.conditions.every((condition) => !condition.ok)).toBe(true);
  });

  it('머리가 너무 높으면 화면을 뒤로 젖히라고 안내한다', () => {
    const result = checkSetup(modified({ [LM.nose]: [0.5, 0.15] }));
    expect(result.ok).toBe(false);
    expect(result.primaryHint).toBe(SETUP_HINTS.headTooHigh);
  });

  it('머리가 너무 낮으면 화면을 앞으로 세우라고 안내한다', () => {
    const result = checkSetup(modified({ [LM.nose]: [0.5, 0.5] }));
    expect(result.ok).toBe(false);
    expect(result.primaryHint).toBe(SETUP_HINTS.headTooLow);
  });

  it('어깨가 화면 위쪽에 걸리면 뒤로 젖히라고 안내한다', () => {
    const result = checkSetup(
      modified({
        [LM.leftShoulder]: [0.62, 0.4],
        [LM.rightShoulder]: [0.38, 0.4],
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.primaryHint).toBe(SETUP_HINTS.shoulderTooHigh);
  });

  it('어깨가 화면 아래로 내려가면 앞으로 세우라고 안내한다', () => {
    const result = checkSetup(
      modified({
        [LM.leftShoulder]: [0.62, 0.78],
        [LM.rightShoulder]: [0.38, 0.78],
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.primaryHint).toBe(SETUP_HINTS.shoulderTooLow);
  });

  it('너무 멀면 가까이 앉으라고 안내한다', () => {
    const result = checkSetup(
      modified({
        [LM.leftShoulder]: [0.56, 0.55],
        [LM.rightShoulder]: [0.44, 0.55],
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.primaryHint).toBe(SETUP_HINTS.tooFar);
  });

  it('너무 가까우면 뒤로 물러나라고 안내한다', () => {
    const result = checkSetup(
      modified({
        [LM.leftShoulder]: [0.75, 0.55],
        [LM.rightShoulder]: [0.25, 0.55],
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.primaryHint).toBe(SETUP_HINTS.tooClose);
  });

  it('화면 가운데에서 벗어나면 가운데로 오라고 안내한다', () => {
    const result = checkSetup(
      modified({
        [LM.leftShoulder]: [0.32, 0.55],
        [LM.rightShoulder]: [0.08, 0.55],
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.primaryHint).toBe(SETUP_HINTS.offCenter);
  });

  it('어깨가 기울면 수평으로 앉으라고 안내한다', () => {
    const result = checkSetup(
      modified({
        [LM.leftShoulder]: [0.62, 0.5],
        [LM.rightShoulder]: [0.38, 0.6],
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.primaryHint).toBe(SETUP_HINTS.shouldersUneven);
  });

  it('안내 임계값은 상수로 노출된다', () => {
    expect(SETUP_RANGES.noseY.min).toBeLessThan(SETUP_RANGES.noseY.max);
    expect(SETUP_RANGES.shoulderWidth.min).toBeLessThan(SETUP_RANGES.shoulderWidth.max);
  });
});
