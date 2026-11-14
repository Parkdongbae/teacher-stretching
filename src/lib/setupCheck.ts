import { allVisible, getPoint, LM, mid, shoulderTiltDeg } from './geometry';
import type { Landmarks, SetupCondition, SetupResult } from './types';

/**
 * 화면(힌지) 각도·거리 안내 문구.
 * 실제 카메라에서 방향이 반대로 느껴질 경우 이 상수만 고치면 된다.
 */
export const SETUP_HINTS = {
  noPerson: '카메라 앞에 앉아 주세요',
  headTooHigh: '화면을 뒤로 조금 젖혀 주세요',
  headTooLow: '화면을 앞으로 조금 세워 주세요',
  shoulderTooHigh: '화면을 뒤로 조금 젖혀 주세요',
  shoulderTooLow: '화면을 앞으로 조금 세워 주세요',
  tooFar: '조금 더 가까이 앉아 주세요',
  tooClose: '조금 뒤로 물러나 주세요',
  offCenter: '화면 가운데로 이동해 주세요',
  shouldersUneven: '어깨를 수평으로, 바르게 앉아 주세요',
} as const;

export const SETUP_RANGES = {
  noseY: { min: 0.22, max: 0.45 },
  shoulderY: { min: 0.45, max: 0.72 },
  shoulderWidth: { min: 0.22, max: 0.42 },
  shoulderMidX: { min: 0.4, max: 0.6 },
  shoulderTiltMax: 6,
  personVisibility: 0.6,
} as const;

interface CheckItem extends SetupCondition {
  hint: string;
}

function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

export function checkSetup(landmarks: Landmarks): SetupResult {
  const personVisible = allVisible(
    landmarks,
    [LM.nose, LM.leftShoulder, LM.rightShoulder],
    SETUP_RANGES.personVisibility,
  );

  if (!personVisible) {
    const conditions: SetupCondition[] = [
      { id: 'person', label: '사람이 감지됨', ok: false },
      { id: 'head', label: '머리 위치', ok: false },
      { id: 'shoulder-height', label: '어깨 높이', ok: false },
      { id: 'distance', label: '카메라 거리', ok: false },
      { id: 'center', label: '가운데 정렬', ok: false },
      { id: 'shoulder-level', label: '어깨 수평', ok: false },
    ];
    return {
      ok: false,
      personVisible: false,
      conditions,
      primaryHint: SETUP_HINTS.noPerson,
    };
  }

  const nose = getPoint(landmarks, LM.nose);
  const shoulderL = getPoint(landmarks, LM.leftShoulder);
  const shoulderR = getPoint(landmarks, LM.rightShoulder);
  const shoulderMid = mid(shoulderL, shoulderR);
  const shoulderWidth = Math.abs(shoulderL.x - shoulderR.x);
  const tilt = Math.abs(shoulderTiltDeg(landmarks));

  const items: CheckItem[] = [
    { id: 'person', label: '사람이 감지됨', ok: true, hint: '' },
    {
      id: 'head',
      label: '머리 위치',
      ok: inRange(nose.y, SETUP_RANGES.noseY.min, SETUP_RANGES.noseY.max),
      hint: nose.y < SETUP_RANGES.noseY.min ? SETUP_HINTS.headTooHigh : SETUP_HINTS.headTooLow,
    },
    {
      id: 'shoulder-height',
      label: '어깨 높이',
      ok: inRange(shoulderMid.y, SETUP_RANGES.shoulderY.min, SETUP_RANGES.shoulderY.max),
      hint:
        shoulderMid.y < SETUP_RANGES.shoulderY.min
          ? SETUP_HINTS.shoulderTooHigh
          : SETUP_HINTS.shoulderTooLow,
    },
    {
      id: 'distance',
      label: '카메라 거리',
      ok: inRange(
        shoulderWidth,
        SETUP_RANGES.shoulderWidth.min,
        SETUP_RANGES.shoulderWidth.max,
      ),
      hint:
        shoulderWidth < SETUP_RANGES.shoulderWidth.min ? SETUP_HINTS.tooFar : SETUP_HINTS.tooClose,
    },
    {
      id: 'center',
      label: '가운데 정렬',
      ok: inRange(
        shoulderMid.x,
        SETUP_RANGES.shoulderMidX.min,
        SETUP_RANGES.shoulderMidX.max,
      ),
      hint: SETUP_HINTS.offCenter,
    },
    {
      id: 'shoulder-level',
      label: '어깨 수평',
      ok: tilt <= SETUP_RANGES.shoulderTiltMax,
      hint: SETUP_HINTS.shouldersUneven,
    },
  ];

  const firstFailing = items.find((item) => !item.ok);
  return {
    ok: !firstFailing,
    personVisible: true,
    conditions: items.map(({ id, label, ok }) => ({ id, label, ok })),
    primaryHint: firstFailing ? firstFailing.hint : null,
  };
}
