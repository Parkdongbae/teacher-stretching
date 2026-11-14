import { EXERCISES } from '../data/exercises';
import { clamp } from './geometry';
import type { Exercise, ExerciseId, Side, Step } from './types';

export const PREP_SEC = 5;
export const MIN_HOLD_SEC = 10;
export const MAX_HOLD_SEC = 30;
export const BREATHE_HOLD_SEC = 30;

/** 루틴 순서: 목 → 어깨 → 팔·가슴 → 옆구리·등·몸통 */
const ROUTINE_ORDER: ExerciseId[] = [
  'neck-tilt',
  'neck-turn',
  'neck-down',
  'shoulder-shrug',
  'overhead-reach',
  'cross-arm',
  'triceps',
  'chest-open',
  'arms-wide',
  'side-bend',
  'back-round',
  'torso-twist',
];

function priorityFloor(minutes: number): number {
  if (minutes <= 1) return 9;
  if (minutes <= 3) return 8;
  if (minutes <= 5) return 5;
  if (minutes <= 7) return 3;
  return 0;
}

function selectGroups(minutes: number): Exercise[] {
  const floor = priorityFloor(minutes);
  return ROUTINE_ORDER.map((id) => EXERCISES.find((exercise) => exercise.id === id)).filter(
    (exercise): exercise is Exercise => Boolean(exercise) && (exercise as Exercise).priority >= floor,
  );
}

function stepCount(groups: Exercise[]): number {
  return groups.reduce((sum, exercise) => sum + (exercise.hasSides ? 2 : 1), 0);
}

export function totalRoutineSec(steps: Step[]): number {
  return steps.reduce((sum, step) => sum + step.prepSec + step.holdSec, 0);
}

/**
 * 시간에 맞는 루틴을 만든다.
 * 불변식: 모든 step 의 (prepSec + holdSec) 합 = minutes × 60, holdSec ≥ 10.
 */
export function buildRoutine(minutesInput: number): Step[] {
  const minutes = clamp(Math.round(minutesInput), 1, 10);
  const target = minutes * 60;
  const withBreathe = minutes >= 2;

  let groups = selectGroups(minutes);

  const breatheSec = withBreathe ? PREP_SEC + BREATHE_HOLD_SEC : 0;
  const budget = target - breatheSec;
  const desiredHold = minutes >= 3 ? 15 : MIN_HOLD_SEC;

  const averageFor = (roundCount: number): number => {
    const count = stepCount(groups) * roundCount;
    if (count === 0) return Number.POSITIVE_INFINITY;
    return (budget - PREP_SEC * count) / count;
  };

  // hold 이 너무 짧으면 우선순위가 낮은 동작부터 뺀다.
  while (groups.length > 0 && averageFor(1) < desiredHold) {
    let worstIndex = 0;
    for (let i = 1; i < groups.length; i += 1) {
      if (groups[i].priority <= groups[worstIndex].priority) worstIndex = i;
    }
    groups = groups.filter((_, index) => index !== worstIndex);
  }

  // hold 이 너무 길면(긴 시간 + 적은 동작) 같은 루틴을 한 번 더 돈다.
  let rounds = 1;
  while (averageFor(rounds) > MAX_HOLD_SEC && rounds < 3 && groups.length > 0) {
    rounds += 1;
  }

  const ordered: Exercise[] = [];
  for (let round = 0; round < rounds; round += 1) {
    ordered.push(...groups);
  }

  const steps: Step[] = [];
  for (const exercise of ordered) {
    const sides: Array<Side | undefined> = exercise.hasSides ? ['right', 'left'] : [undefined];
    for (const side of sides) {
      steps.push({
        exerciseId: exercise.id,
        side,
        prepSec: PREP_SEC,
        holdSec: exercise.holdSec,
      });
    }
  }
  if (withBreathe) {
    steps.push({
      exerciseId: 'breathe',
      prepSec: PREP_SEC,
      holdSec: BREATHE_HOLD_SEC,
    });
  }

  const otherSteps = withBreathe ? steps.slice(0, -1) : steps;
  const available = budget - PREP_SEC * otherSteps.length;
  const baseHold = Math.max(MIN_HOLD_SEC, Math.floor(available / otherSteps.length));
  let remainder = available - baseHold * otherSteps.length;

  otherSteps.forEach((step) => {
    step.holdSec = baseHold;
    if (remainder > 0) {
      step.holdSec += 1;
      remainder -= 1;
    }
  });

  // 남은 초는 마지막 step 에서 보정해 총합을 정확히 맞춘다.
  const total = totalRoutineSec(steps);
  const diff = target - total;
  const last = steps[steps.length - 1];
  if (last) {
    last.holdSec += diff;
  }

  return steps;
}

/** 화면 미리보기용: 동작 이름 목록 */
export function routinePreview(minutes: number): Array<{ exerciseId: ExerciseId; side?: Side }> {
  return buildRoutine(minutes).map((step) => ({ exerciseId: step.exerciseId, side: step.side }));
}
