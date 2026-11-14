import { THRESHOLDS } from '../data/exercises';
import {
  allVisible,
  angleDeg,
  clamp01,
  dist,
  earTiltDeg,
  getPoint,
  LM,
  mid,
  shoulderTiltDeg,
} from './geometry';
import type {
  Baseline,
  Evaluation,
  ExerciseId,
  Landmarks,
  PoseCheck,
  Side,
} from './types';

interface Spec {
  id: string;
  progress: number;
  hint: string;
  weight?: number;
}

const ARMS_HIDDEN = '팔이 화면에 보이도록 해 주세요';
const BODY_HIDDEN = '몸이 화면에 보이도록 해 주세요';

/** value 가 from 이면 0, to 이면 1 (from < to) */
function ramp(value: number, from: number, to: number): number {
  if (to === from) return value >= to ? 1 : 0;
  return clamp01((value - from) / (to - from));
}

/** value 가 from 이면 1, to 이면 0 */
function decline(value: number, from: number, to: number): number {
  return 1 - ramp(value, from, to);
}

function finalize(specs: Spec[], visible: boolean, hiddenHint: string): Evaluation {
  if (!visible) {
    const checks: PoseCheck[] = specs.map((spec) => ({
      id: spec.id,
      ok: false,
      progress: 0,
      hint: hiddenHint,
    }));
    return { score: 0, checks };
  }

  let weightSum = 0;
  let scoreSum = 0;
  for (const spec of specs) {
    const weight = spec.weight ?? 1;
    weightSum += weight;
    scoreSum += spec.progress * weight;
  }

  return {
    score: weightSum > 0 ? scoreSum / weightSum : 0,
    checks: specs.map((spec) => ({
      id: spec.id,
      ok: spec.progress >= 0.8,
      progress: spec.progress,
      hint: spec.hint,
    })),
  };
}

function sw(baseline: Baseline): number {
  return Math.max(baseline.shoulderWidth, 1e-6);
}

function sideLabel(side: Side): string {
  return side === 'right' ? '오른쪽' : '왼쪽';
}

/** 목 옆으로 기울이기 */
function neckTilt(lm: Landmarks, _baseline: Baseline, side: Side = 'right'): Evaluation {
  const tilt = earTiltDeg(lm);
  const directional = side === 'right' ? tilt : -tilt;
  const shoulderTilt = Math.abs(shoulderTiltDeg(lm));

  const specs: Spec[] = [
    {
      id: 'tilt',
      progress: ramp(directional, 5, THRESHOLDS.neckTilt.minTilt),
      weight: 2,
      hint: `고개를 ${sideLabel(side)}으로 조금 더 기울여 주세요`,
    },
    {
      id: 'shoulder-level',
      progress: decline(shoulderTilt, THRESHOLDS.neckTilt.shoulderMax, 20),
      hint: '어깨는 내리고 고개만 기울이세요',
    },
  ];
  return finalize(specs, allVisible(lm, [LM.leftEar, LM.rightEar, LM.leftShoulder, LM.rightShoulder]), BODY_HIDDEN);
}

/** 목 좌우 돌리기 */
function neckTurn(lm: Landmarks, baseline: Baseline, side: Side = 'right'): Evaluation {
  const nose = getPoint(lm, LM.nose);
  const earMid = mid(getPoint(lm, LM.leftEar), getPoint(lm, LM.rightEar));
  const current = (nose.x - earMid.x) / sw(baseline);
  const base = baseline.noseOffsetX / sw(baseline);
  const delta = current - base;
  const directional = side === 'right' ? -delta : delta;
  const shoulderTilt = Math.abs(shoulderTiltDeg(lm));

  const specs: Spec[] = [
    {
      id: 'turn',
      progress: ramp(directional, 0.03, THRESHOLDS.neckTurn.minShift),
      weight: 2,
      hint: `고개를 ${sideLabel(side)}으로 조금 더 돌려 주세요`,
    },
    {
      id: 'shoulder-level',
      progress: decline(shoulderTilt, 8, 20),
      hint: '어깨는 정면으로, 수평을 유지하세요',
    },
  ];
  return finalize(
    specs,
    allVisible(lm, [LM.nose, LM.leftEar, LM.rightEar, LM.leftShoulder, LM.rightShoulder]),
    BODY_HIDDEN,
  );
}

/** 고개 숙여 목 뒤 늘리기 */
function neckDown(lm: Landmarks, baseline: Baseline): Evaluation {
  const nose = getPoint(lm, LM.nose);
  const shoulderMid = mid(getPoint(lm, LM.leftShoulder), getPoint(lm, LM.rightShoulder));
  const current = (shoulderMid.y - nose.y) / sw(baseline);
  const base = (baseline.shoulderMid.y - baseline.nose.y) / sw(baseline);
  const drop = base - current;
  const shoulderTilt = Math.abs(shoulderTiltDeg(lm));

  const specs: Spec[] = [
    {
      id: 'head-down',
      progress: ramp(drop, 0.03, THRESHOLDS.neckDown.minDrop),
      weight: 2,
      hint: '고개를 조금 더 숙여 주세요',
    },
    {
      id: 'shoulder-level',
      progress: decline(shoulderTilt, 8, 20),
      hint: '양 어깨의 힘을 빼고 수평으로 유지하세요',
    },
  ];
  return finalize(specs, allVisible(lm, [LM.nose, LM.leftShoulder, LM.rightShoulder]), BODY_HIDDEN);
}

/** 어깨 으쓱 올렸다 유지 */
function shoulderShrug(lm: Landmarks, baseline: Baseline): Evaluation {
  const earMid = mid(getPoint(lm, LM.leftEar), getPoint(lm, LM.rightEar));
  const shoulderMid = mid(getPoint(lm, LM.leftShoulder), getPoint(lm, LM.rightShoulder));
  const current = (shoulderMid.y - earMid.y) / sw(baseline);
  const base = baseline.earShoulderDist / sw(baseline);
  const rise = base - current;

  const specs: Spec[] = [
    {
      id: 'shoulders-up',
      progress: ramp(rise, 0.02, THRESHOLDS.shoulderShrug.minRise),
      weight: 2,
      hint: '양 어깨를 귀 쪽으로 조금 더 올려 주세요',
    },
  ];
  return finalize(specs, allVisible(lm, [LM.leftEar, LM.rightEar, LM.leftShoulder, LM.rightShoulder]), BODY_HIDDEN);
}

/** 깍지 끼고 위로 기지개 */
function overheadReach(lm: Landmarks, baseline: Baseline): Evaluation {
  const nose = getPoint(lm, LM.nose);
  const wristL = getPoint(lm, LM.leftWrist);
  const wristR = getPoint(lm, LM.rightWrist);
  const above = Math.min(nose.y - wristL.y, nose.y - wristR.y) / sw(baseline);
  const elbow = Math.min(
    angleDeg(getPoint(lm, LM.leftShoulder), getPoint(lm, LM.leftElbow), wristL),
    angleDeg(getPoint(lm, LM.rightShoulder), getPoint(lm, LM.rightElbow), wristR),
  );
  const span = dist(wristL, wristR) / sw(baseline);

  const specs: Spec[] = [
    {
      id: 'reach-up',
      progress: ramp(above, 0.05, THRESHOLDS.overheadReach.minAbove),
      weight: 2,
      hint: '양팔을 머리 위로 더 뻗어 주세요',
    },
    {
      id: 'elbows-straight',
      progress: ramp(elbow, 120, THRESHOLDS.overheadReach.minElbow),
      hint: '팔꿈치를 펴 주세요',
    },
    {
      id: 'hands-together',
      progress: decline(span, THRESHOLDS.overheadReach.maxWristGap, 1.2),
      hint: '두 손을 조금 더 가까이 모아 주세요',
    },
  ];
  return finalize(
    specs,
    allVisible(lm, [LM.nose, LM.leftShoulder, LM.rightShoulder, LM.leftElbow, LM.rightElbow, LM.leftWrist, LM.rightWrist]),
    ARMS_HIDDEN,
  );
}

/** 옆구리 늘리기 */
function sideBend(lm: Landmarks, baseline: Baseline, side: Side = 'right'): Evaluation {
  const nose = getPoint(lm, LM.nose);
  const oppositeWrist = getPoint(lm, side === 'right' ? LM.leftWrist : LM.rightWrist);
  const armUp = (nose.y - oppositeWrist.y) / sw(baseline);
  const tilt = shoulderTiltDeg(lm);
  const directional = side === 'right' ? tilt : -tilt;
  const oppositeName = side === 'right' ? '왼팔' : '오른팔';

  const specs: Spec[] = [
    {
      id: 'opposite-arm-up',
      progress: ramp(armUp, 0, 0.25),
      weight: 2,
      hint: `${oppositeName}을 머리 위로 올려 주세요`,
    },
    {
      id: 'side-bend',
      progress: ramp(directional, 3, THRESHOLDS.sideBend.minTilt),
      hint: `상체를 ${sideLabel(side)}으로 조금 더 기울여 주세요`,
    },
  ];
  return finalize(
    specs,
    allVisible(lm, [
      LM.nose,
      LM.leftShoulder,
      LM.rightShoulder,
      LM.leftElbow,
      LM.rightElbow,
      LM.leftWrist,
      LM.rightWrist,
    ]),
    ARMS_HIDDEN,
  );
}

/** 팔 가슴 앞으로 당기기 */
function crossArm(lm: Landmarks, baseline: Baseline, side: Side = 'right'): Evaluation {
  const shoulder = getPoint(lm, side === 'right' ? LM.rightShoulder : LM.leftShoulder);
  const elbow = getPoint(lm, side === 'right' ? LM.rightElbow : LM.leftElbow);
  const wrist = getPoint(lm, side === 'right' ? LM.rightWrist : LM.leftWrist);
  const oppositeShoulder = getPoint(lm, side === 'right' ? LM.leftShoulder : LM.rightShoulder);
  const shoulderMid = mid(getPoint(lm, LM.leftShoulder), getPoint(lm, LM.rightShoulder));

  const cross =
    side === 'right'
      ? (wrist.x - oppositeShoulder.x) / sw(baseline)
      : (oppositeShoulder.x - wrist.x) / sw(baseline);
  const elbowDeviation = Math.abs(elbow.y - shoulderMid.y) / sw(baseline);
  const elbowAngle = angleDeg(shoulder, elbow, wrist);

  const specs: Spec[] = [
    {
      id: 'cross-body',
      progress: ramp(cross, -0.04, 0.04),
      weight: 2,
      hint: `팔을 반대쪽 어깨 너머로 더 뻗어 주세요`,
    },
    {
      id: 'elbow-height',
      progress: decline(elbowDeviation, THRESHOLDS.crossArm.elbowY, 0.8),
      hint: '팔꿈치를 어깨 높이에 맞춰 주세요',
    },
    {
      id: 'elbow-angle',
      progress: ramp(elbowAngle, 100, THRESHOLDS.crossArm.minElbow),
      hint: '팔꿈치를 조금 더 펴 주세요',
    },
  ];
  return finalize(
    specs,
    allVisible(lm, [
      LM.leftShoulder,
      LM.rightShoulder,
      LM.leftElbow,
      LM.rightElbow,
      LM.leftWrist,
      LM.rightWrist,
    ]),
    ARMS_HIDDEN,
  );
}

/** 팔꿈치 머리 뒤로 당기기 */
function triceps(lm: Landmarks, baseline: Baseline, side: Side = 'right'): Evaluation {
  const ear = getPoint(lm, side === 'right' ? LM.rightEar : LM.leftEar);
  const shoulder = getPoint(lm, side === 'right' ? LM.rightShoulder : LM.leftShoulder);
  const elbow = getPoint(lm, side === 'right' ? LM.rightElbow : LM.leftElbow);
  const wrist = getPoint(lm, side === 'right' ? LM.rightWrist : LM.leftWrist);

  const above = (ear.y - elbow.y) / sw(baseline);
  const elbowAngle = angleDeg(shoulder, elbow, wrist);

  const specs: Spec[] = [
    {
      id: 'elbow-up',
      progress: ramp(above, 0, 0.12),
      weight: 2,
      hint: `팔꿈치를 ${sideLabel(side)} 귀 위로 올려 주세요`,
    },
    {
      id: 'elbow-bent',
      progress: decline(elbowAngle, THRESHOLDS.triceps.maxElbow, 150),
      hint: '팔꿈치를 구부려 손을 등 뒤로 넘겨 주세요',
    },
  ];
  return finalize(
    specs,
    allVisible(lm, [
      LM.leftEar,
      LM.rightEar,
      LM.leftShoulder,
      LM.rightShoulder,
      LM.leftElbow,
      LM.rightElbow,
      LM.leftWrist,
      LM.rightWrist,
    ]),
    ARMS_HIDDEN,
  );
}

/** 손 머리 뒤, 가슴 열기 */
function chestOpen(lm: Landmarks, baseline: Baseline): Evaluation {
  const wristL = getPoint(lm, LM.leftWrist);
  const wristR = getPoint(lm, LM.rightWrist);
  const earL = getPoint(lm, LM.leftEar);
  const earR = getPoint(lm, LM.rightEar);
  const handsNearEars = Math.max(dist(wristL, earL), dist(wristR, earR)) / sw(baseline);
  const elbowSpan = dist(getPoint(lm, LM.leftElbow), getPoint(lm, LM.rightElbow)) / sw(baseline);

  const specs: Spec[] = [
    {
      id: 'hands-behind-head',
      progress: decline(handsNearEars, THRESHOLDS.chestOpen.maxEarDist, 1.2),
      weight: 2,
      hint: '두 손을 머리 뒤에 가깝게 대 주세요',
    },
    {
      id: 'elbows-open',
      progress: ramp(elbowSpan, 1.2, THRESHOLDS.chestOpen.minElbowGap),
      hint: '팔꿈치를 옆으로 더 넓게 벌려 주세요',
    },
  ];
  return finalize(
    specs,
    allVisible(lm, [
      LM.leftEar,
      LM.rightEar,
      LM.leftElbow,
      LM.rightElbow,
      LM.leftWrist,
      LM.rightWrist,
    ]),
    ARMS_HIDDEN,
  );
}

/** 양팔 벌려 가슴 펴기 */
function armsWide(lm: Landmarks, baseline: Baseline): Evaluation {
  const shoulderMid = mid(getPoint(lm, LM.leftShoulder), getPoint(lm, LM.rightShoulder));
  const wristL = getPoint(lm, LM.leftWrist);
  const wristR = getPoint(lm, LM.rightWrist);
  const span = dist(wristL, wristR) / sw(baseline);
  const heightDiff = Math.max(
    Math.abs(wristL.y - shoulderMid.y),
    Math.abs(wristR.y - shoulderMid.y),
  ) / sw(baseline);
  const elbow = Math.min(
    angleDeg(getPoint(lm, LM.leftShoulder), getPoint(lm, LM.leftElbow), wristL),
    angleDeg(getPoint(lm, LM.rightShoulder), getPoint(lm, LM.rightElbow), wristR),
  );

  const specs: Spec[] = [
    {
      id: 'arms-wide',
      progress: ramp(span, 1.8, THRESHOLDS.armsWide.minWristGap),
      weight: 2,
      hint: '양팔을 옆으로 더 넓게 벌려 주세요',
    },
    {
      id: 'shoulder-height',
      progress: decline(heightDiff, THRESHOLDS.armsWide.maxHeightDiff, 0.9),
      hint: '양손을 어깨 높이에 맞춰 주세요',
    },
    {
      id: 'elbows-straight',
      progress: ramp(elbow, 120, THRESHOLDS.armsWide.minElbow),
      hint: '팔꿈치를 펴 주세요',
    },
  ];
  return finalize(
    specs,
    allVisible(lm, [
      LM.leftShoulder,
      LM.rightShoulder,
      LM.leftElbow,
      LM.rightElbow,
      LM.leftWrist,
      LM.rightWrist,
    ]),
    ARMS_HIDDEN,
  );
}

/** 깍지 끼고 앞으로 밀며 등 말기 */
function backRound(lm: Landmarks, baseline: Baseline): Evaluation {
  const shoulderMid = mid(getPoint(lm, LM.leftShoulder), getPoint(lm, LM.rightShoulder));
  const wristL = getPoint(lm, LM.leftWrist);
  const wristR = getPoint(lm, LM.rightWrist);
  const nose = getPoint(lm, LM.nose);
  const wristMid = mid(wristL, wristR);

  const span = dist(wristL, wristR) / sw(baseline);
  const dx = Math.abs(wristMid.x - shoulderMid.x) / sw(baseline);
  const dy = (wristMid.y - shoulderMid.y) / sw(baseline);
  const position = Math.max(
    dx / THRESHOLDS.backRound.maxHorizontal,
    Math.max(0, dy) / THRESHOLDS.backRound.maxVertical,
  );
  const headDrop = (nose.y - baseline.nose.y) / sw(baseline);

  const specs: Spec[] = [
    {
      id: 'hands-together',
      progress: decline(span, THRESHOLDS.backRound.maxWristGap, 1.0),
      weight: 2,
      hint: '두 손을 조금 더 가까이 모아 주세요',
    },
    {
      id: 'hands-forward',
      progress: decline(position, 1, 1.8),
      hint: '두 손을 어깨 앞쪽으로 밀어 주세요',
    },
    {
      id: 'head-down',
      progress: ramp(headDrop, 0.02, THRESHOLDS.backRound.minHeadDrop),
      weight: 2,
      hint: '고개를 조금 더 숙여 주세요',
    },
  ];
  return finalize(
    specs,
    allVisible(lm, [LM.nose, LM.leftShoulder, LM.rightShoulder, LM.leftWrist, LM.rightWrist]),
    BODY_HIDDEN,
  );
}

/** 앉아서 몸통 비틀기 */
function torsoTwist(lm: Landmarks, baseline: Baseline, side: Side = 'right'): Evaluation {
  const shoulderL = getPoint(lm, LM.leftShoulder);
  const shoulderR = getPoint(lm, LM.rightShoulder);
  const shoulderMid = mid(shoulderL, shoulderR);
  const nose = getPoint(lm, LM.nose);

  const width = dist(shoulderL, shoulderR) / sw(baseline);
  const directional =
    side === 'right'
      ? (shoulderMid.x - nose.x) / sw(baseline)
      : (nose.x - shoulderMid.x) / sw(baseline);

  const specs: Spec[] = [
    {
      id: 'twist',
      progress: ramp(directional, 0.03, 0.15),
      weight: 2,
      hint: `상체를 ${sideLabel(side)}으로 조금 더 비틀어 주세요`,
    },
    {
      id: 'narrow',
      progress: decline(width, THRESHOLDS.torsoTwist.maxWidthRatio, 1.05),
      hint: '어깨를 정면으로 돌려 몸통을 비틀어 주세요',
    },
  ];
  return finalize(specs, allVisible(lm, [LM.nose, LM.leftShoulder, LM.rightShoulder]), BODY_HIDDEN);
}

/** 바른 자세로 심호흡 */
function breathe(lm: Landmarks, baseline: Baseline): Evaluation {
  const shoulderMid = mid(getPoint(lm, LM.leftShoulder), getPoint(lm, LM.rightShoulder));
  const nose = getPoint(lm, LM.nose);
  const tilt = Math.abs(shoulderTiltDeg(lm));
  const offset = Math.abs(nose.x - shoulderMid.x) / sw(baseline);

  const specs: Spec[] = [
    {
      id: 'shoulder-level',
      progress: decline(tilt, THRESHOLDS.breathe.maxShoulderTilt, 15),
      hint: '어깨를 수평으로, 바르게 앉아 주세요',
    },
    {
      id: 'head-center',
      progress: decline(offset, THRESHOLDS.breathe.maxNoseOffset, 0.5),
      hint: '고개를 가운데로 두고 편하게 앉아 주세요',
    },
  ];
  return finalize(specs, allVisible(lm, [LM.nose, LM.leftShoulder, LM.rightShoulder]), BODY_HIDDEN);
}

export const EVALUATORS: Record<ExerciseId, (lm: Landmarks, baseline: Baseline, side?: Side) => Evaluation> = {
  'neck-tilt': neckTilt,
  'neck-turn': neckTurn,
  'neck-down': neckDown,
  'shoulder-shrug': shoulderShrug,
  'overhead-reach': overheadReach,
  'side-bend': sideBend,
  'cross-arm': crossArm,
  triceps,
  'chest-open': chestOpen,
  'arms-wide': armsWide,
  'back-round': backRound,
  'torso-twist': torsoTwist,
  breathe,
};

export function evaluateExercise(
  id: ExerciseId,
  landmarks: Landmarks,
  baseline: Baseline,
  side?: Side,
): Evaluation {
  const evaluator = EVALUATORS[id];
  return evaluator(landmarks, baseline, side);
}

/** EMA 평활 (α = 0.25) */
export function smoothScore(previous: number | null, next: number, alpha = 0.25): number {
  if (previous === null) return next;
  return previous + alpha * (next - previous);
}

/** 상태 등급: good / warn / bad */
export function scoreLevel(score: number): 'good' | 'warn' | 'bad' {
  if (score >= 0.8) return 'good';
  if (score >= 0.5) return 'warn';
  return 'bad';
}

/** 가장 개선이 필요한 check */
export function lowestCheck(evaluation: Evaluation): PoseCheck | null {
  const failing = evaluation.checks.filter((check) => !check.ok);
  if (failing.length === 0) return null;
  return failing.reduce((lowest, check) => (check.progress < lowest.progress ? check : lowest));
}

export function feedbackFor(evaluation: Evaluation, smoothedScore: number): string {
  const level = scoreLevel(smoothedScore);
  if (level === 'good') return '좋아요! 그대로 유지하세요';
  const lowest = lowestCheck(evaluation);
  if (level === 'warn') return lowest?.hint ?? '조금만 더 자세를 맞춰 보세요';
  const base = '시범 그림을 보고 자세를 맞춰 주세요';
  return lowest ? `${base} · ${lowest.hint}` : base;
}
