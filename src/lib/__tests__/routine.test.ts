import { describe, expect, it } from 'vitest';
import { EXERCISE_MAP } from '../../data/exercises';
import {
  BREATHE_HOLD_SEC,
  buildRoutine,
  MIN_HOLD_SEC,
  PREP_SEC,
  totalRoutineSec,
} from '../routine';
import type { Step } from '../types';

const MINUTES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function holds(steps: Step[]): number[] {
  return steps.map((step) => step.holdSec);
}

describe('buildRoutine 불변식', () => {
  for (const minutes of MINUTES) {
    describe(`${minutes}분`, () => {
      const steps = buildRoutine(minutes);

      it('전체 길이가 정확히 분×60초이다', () => {
        expect(totalRoutineSec(steps)).toBe(minutes * 60);
      });

      it('모든 유지 시간이 10초 이상이다', () => {
        for (const hold of holds(steps)) {
          expect(hold).toBeGreaterThanOrEqual(MIN_HOLD_SEC);
        }
      });

      it('모든 준비 시간이 PREP_SEC 이다', () => {
        expect(steps.every((step) => step.prepSec === PREP_SEC)).toBe(true);
      });

      it('모든 동작이 실제로 존재한다', () => {
        for (const step of steps) {
          expect(EXERCISE_MAP[step.exerciseId]).toBeDefined();
        }
      });

      it('좌우 세트는 오른쪽 다음 왼쪽이 연속으로 온다', () => {
        steps.forEach((step, index) => {
          if (step.side !== 'right') return;
          const next = steps[index + 1];
          expect(next).toBeDefined();
          expect(next.exerciseId).toBe(step.exerciseId);
          expect(next.side).toBe('left');
        });
        steps.forEach((step, index) => {
          if (step.side !== 'left') return;
          const previous = steps[index - 1];
          expect(previous).toBeDefined();
          expect(previous.exerciseId).toBe(step.exerciseId);
          expect(previous.side).toBe('right');
        });
      });

      it('좌우 동작이 있는 종목은 양쪽이 모두 들어간다', () => {
        const sided = new Set(
          steps
            .filter((step) => EXERCISE_MAP[step.exerciseId].hasSides)
            .map((step) => step.exerciseId),
        );
        for (const id of sided) {
          const sides = steps.filter((step) => step.exerciseId === id).map((step) => step.side);
          expect(sides).toContain('right');
          expect(sides).toContain('left');
        }
      });

      if (minutes >= 2) {
        it('마지막은 30초 호흡이다', () => {
          const last = steps[steps.length - 1];
          expect(last.exerciseId).toBe('breathe');
          expect(last.holdSec).toBe(BREATHE_HOLD_SEC);
        });
      } else {
        it('1분 루틴에는 호흡 마무리가 없다', () => {
          expect(steps.some((step) => step.exerciseId === 'breathe')).toBe(false);
        });
      }
    });
  }
});

describe('buildRoutine 입력 보정', () => {
  it('0분 이하는 1분 루틴으로 처리한다', () => {
    expect(totalRoutineSec(buildRoutine(0))).toBe(60);
  });

  it('10분을 넘으면 10분 루틴으로 처리한다', () => {
    expect(totalRoutineSec(buildRoutine(25))).toBe(600);
  });

  it('1분 루틴은 동작 수가 적고 3분보다 짧다', () => {
    const one = buildRoutine(1);
    const three = buildRoutine(3);
    expect(one.length).toBeLessThan(three.length);
  });

  it('분이 늘어나도 동작 종류는 중복 추가되지 않는다', () => {
    const ids = (minutes: number): string[] =>
      buildRoutine(minutes).map((step) => `${step.exerciseId}-${step.side ?? 'none'}`);
    for (const step of ids(10)) {
      expect(ids(10).filter((value) => value === step).length).toBeLessThanOrEqual(3);
    }
  });
});
