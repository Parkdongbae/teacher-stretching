import { describe, expect, it } from 'vitest';
import { EXERCISES } from '../../data/exercises';
import { EVALUATORS, evaluateExercise, scoreLevel, smoothScore } from '../evaluate';
import { computeBaseline, LM } from '../geometry';
import type { ExerciseId, Landmarks } from '../types';

type Patch = Record<number, [number, number]>;

const UPRIGHT: Patch = {
  [LM.nose]: [0.5, 0.35],
  [LM.leftEar]: [0.57, 0.36],
  [LM.rightEar]: [0.43, 0.36],
  [LM.leftShoulder]: [0.65, 0.6],
  [LM.rightShoulder]: [0.35, 0.6],
  [LM.leftElbow]: [0.7, 0.76],
  [LM.rightElbow]: [0.3, 0.76],
  [LM.leftWrist]: [0.72, 0.9],
  [LM.rightWrist]: [0.28, 0.9],
  [LM.leftHip]: [0.62, 0.92],
  [LM.rightHip]: [0.38, 0.92],
};

/** 흐트러진 자세: 오른쪽 어깨가 처지고 고개가 앞으로 나온 상태 */
const SLUMPED: Patch = {
  ...UPRIGHT,
  [LM.nose]: [0.56, 0.36],
  [LM.leftEar]: [0.57, 0.28],
  [LM.rightEar]: [0.43, 0.28],
  [LM.leftShoulder]: [0.65, 0.557],
  [LM.rightShoulder]: [0.35, 0.643],
};

/** 각 동작의 목표 자세. 기준 자세에서 필요한 관절만 옮긴다. */
const TARGETS: Record<ExerciseId, Patch> = {
  'neck-tilt': {
    ...UPRIGHT,
    [LM.leftEar]: [0.56, 0.34],
    [LM.rightEar]: [0.44, 0.4],
  },
  'neck-turn': {
    ...UPRIGHT,
    [LM.nose]: [0.44, 0.35],
  },
  'neck-down': {
    ...UPRIGHT,
    [LM.nose]: [0.5, 0.42],
  },
  'shoulder-shrug': {
    ...UPRIGHT,
    [LM.leftShoulder]: [0.65, 0.555],
    [LM.rightShoulder]: [0.35, 0.555],
    [LM.leftElbow]: [0.7, 0.72],
    [LM.rightElbow]: [0.3, 0.72],
    [LM.leftWrist]: [0.72, 0.86],
    [LM.rightWrist]: [0.28, 0.86],
  },
  'overhead-reach': {
    ...UPRIGHT,
    [LM.leftElbow]: [0.56, 0.4],
    [LM.rightElbow]: [0.44, 0.4],
    [LM.leftWrist]: [0.55, 0.2],
    [LM.rightWrist]: [0.45, 0.2],
  },
  'side-bend': {
    ...UPRIGHT,
    [LM.leftShoulder]: [0.66, 0.585],
    [LM.rightShoulder]: [0.34, 0.65],
    [LM.leftElbow]: [0.62, 0.4],
    [LM.leftWrist]: [0.6, 0.2],
  },
  'cross-arm': {
    ...UPRIGHT,
    [LM.rightElbow]: [0.48, 0.6],
    [LM.rightWrist]: [0.7, 0.6],
  },
  triceps: {
    ...UPRIGHT,
    [LM.rightElbow]: [0.57, 0.3],
    [LM.rightWrist]: [0.6, 0.55],
  },
  'chest-open': {
    ...UPRIGHT,
    [LM.leftElbow]: [0.85, 0.48],
    [LM.rightElbow]: [0.15, 0.48],
    [LM.leftWrist]: [0.55, 0.38],
    [LM.rightWrist]: [0.45, 0.38],
  },
  'arms-wide': {
    ...UPRIGHT,
    [LM.leftElbow]: [0.8, 0.6],
    [LM.rightElbow]: [0.2, 0.6],
    [LM.leftWrist]: [0.95, 0.6],
    [LM.rightWrist]: [0.05, 0.6],
  },
  'back-round': {
    ...UPRIGHT,
    [LM.nose]: [0.5, 0.5],
    [LM.leftElbow]: [0.6, 0.62],
    [LM.rightElbow]: [0.4, 0.62],
    [LM.leftWrist]: [0.57, 0.72],
    [LM.rightWrist]: [0.43, 0.72],
  },
  'torso-twist': {
    ...UPRIGHT,
    [LM.nose]: [0.45, 0.35],
    [LM.leftShoulder]: [0.6, 0.6],
    [LM.rightShoulder]: [0.4, 0.6],
    [LM.leftElbow]: [0.62, 0.75],
    [LM.rightElbow]: [0.38, 0.75],
  },
  breathe: { ...UPRIGHT },
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

const baseline = computeBaseline([pose(UPRIGHT)]);

describe('판정기 공통', () => {
  it('13개 동작 모두 판정기가 있다', () => {
    expect(EXERCISES).toHaveLength(13);
    for (const exercise of EXERCISES) {
      expect(typeof EVALUATORS[exercise.id]).toBe('function');
    }
  });

  it('점수는 0~1 범위이고 체크 항목이 비어 있지 않다', () => {
    for (const exercise of EXERCISES) {
      const evaluation = evaluateExercise(exercise.id, pose(TARGETS[exercise.id]), baseline, 'right');
      expect(evaluation.score).toBeGreaterThanOrEqual(0);
      expect(evaluation.score).toBeLessThanOrEqual(1);
      expect(evaluation.checks.length).toBeGreaterThan(0);
    }
  });

  it('핵심 관절이 보이지 않으면 점수 0', () => {
    const hidden = pose(TARGETS['neck-tilt'], 0);
    const evaluation = evaluateExercise('neck-tilt', hidden, baseline, 'right');
    expect(evaluation.score).toBe(0);
    expect(evaluation.checks.every((check) => !check.ok && check.progress === 0)).toBe(true);
  });
});

describe.each(EXERCISES.map((exercise) => [exercise.id, exercise] as const))(
  '%s 판정',
  (id, exercise) => {
    const side = exercise.hasSides ? 'right' : undefined;

    it('목표 자세는 0.8 이상', () => {
      const evaluation = evaluateExercise(id, pose(TARGETS[id]), baseline, side);
      expect(evaluation.score).toBeGreaterThanOrEqual(0.8);
      expect(evaluation.checks.every((check) => check.progress > 0)).toBe(true);
    });

    it('흐트러진 자세는 0.5 미만', () => {
      const evaluation = evaluateExercise(id, pose(SLUMPED), baseline, side);
      expect(evaluation.score).toBeLessThan(0.5);
    });

    if (exercise.hasSides) {
      it('반대쪽 자세는 0.5 미만', () => {
        const evaluation = evaluateExercise(
          id,
          pose(TARGETS[id]),
          baseline,
          side === 'right' ? 'left' : 'right',
        );
        expect(evaluation.score).toBeLessThan(0.5);
      });
    }
  },
);

describe('평활과 등급', () => {
  it('smoothScore 첫 값은 그대로, 이후 EMA(α=0.25)', () => {
    expect(smoothScore(null, 0.4)).toBe(0.4);
    expect(smoothScore(0, 1)).toBeCloseTo(0.25, 6);
    expect(smoothScore(0.8, 0.8)).toBeCloseTo(0.8, 6);
  });

  it('scoreLevel 경계값', () => {
    expect(scoreLevel(1)).toBe('good');
    expect(scoreLevel(0.8)).toBe('good');
    expect(scoreLevel(0.79)).toBe('warn');
    expect(scoreLevel(0.5)).toBe('warn');
    expect(scoreLevel(0.49)).toBe('bad');
  });
});
