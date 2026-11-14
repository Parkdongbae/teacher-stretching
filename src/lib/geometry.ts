import type { Baseline, Landmark, Landmarks, Point } from './types';

/** MediaPipe Pose 랜드마크 인덱스 (left/right = 사용자 본인 기준) */
export const LM = {
  nose: 0,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
} as const;

export const VISIBILITY_MIN = 0.5;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function mid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** b 를 꼭짓점으로 하는 각 a-b-c (도, 0~180) */
export function angleDeg(a: Point, b: Point, c: Point): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const n1 = Math.hypot(v1x, v1y);
  const n2 = Math.hypot(v2x, v2y);
  if (n1 < 1e-9 || n2 < 1e-9) return 0;
  const cos = clamp((v1x * v2x + v1y * v2y) / (n1 * n2), -1, 1);
  return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * 두 점을 잇는 선의 기울기(도).
 * right 는 사용자 기준 오른쪽 점, left 는 왼쪽 점.
 * 오른쪽이 아래로 처지면 양수, 왼쪽이 아래로 처지면 음수.
 */
export function lineTiltDeg(right: Point, left: Point): number {
  const dx = Math.abs(left.x - right.x);
  const dy = right.y - left.y;
  if (dx < 1e-6) return dy >= 0 ? 90 : -90;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/** 어깨 기울기: 양수 = 사용자 오른쪽 어깨가 아래 */
export function shoulderTiltDeg(landmarks: Landmarks): number {
  return lineTiltDeg(
    landmarks[LM.rightShoulder] ?? { x: 0, y: 0 },
    landmarks[LM.leftShoulder] ?? { x: 0, y: 0 },
  );
}

/** 귀선 기울기: 양수 = 사용자 오른쪽으로 고개 기울임 */
export function earTiltDeg(landmarks: Landmarks): number {
  return lineTiltDeg(
    landmarks[LM.rightEar] ?? { x: 0, y: 0 },
    landmarks[LM.leftEar] ?? { x: 0, y: 0 },
  );
}

export function getPoint(landmarks: Landmarks, index: number): Point {
  const landmark = landmarks[index];
  return landmark ? { x: landmark.x, y: landmark.y } : { x: 0, y: 0 };
}

export function isVisible(landmarks: Landmarks, index: number, min = VISIBILITY_MIN): boolean {
  const landmark: Landmark | undefined = landmarks[index];
  if (!landmark) return false;
  return (landmark.visibility ?? 1) >= min;
}

export function allVisible(landmarks: Landmarks, indices: number[], min = VISIBILITY_MIN): boolean {
  return indices.every((index) => isVisible(landmarks, index, min));
}

/** 정규화 거리 (baseline 어깨 너비로 나눔) */
export function normDist(a: Point, b: Point, shoulderWidth: number): number {
  if (shoulderWidth <= 1e-6) return 0;
  return dist(a, b) / shoulderWidth;
}

export function poseFingerprint(landmarks: Landmarks): string {
  return landmarks
    .map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`)
    .join(';');
}

function averagePoints(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/**
 * 여러 프레임의 랜드마크 평균으로 기준 자세를 만든다.
 * visibility 가 낮은 샘플은 제외한다.
 */
export function computeBaseline(samples: Landmarks[]): Baseline {
  const usable = samples.filter(
    (lm) =>
      allVisible(lm, [LM.nose, LM.leftEar, LM.rightEar, LM.leftShoulder, LM.rightShoulder], 0.5) &&
      Math.abs((lm[LM.leftShoulder]?.x ?? 0) - (lm[LM.rightShoulder]?.x ?? 0)) > 1e-4,
  );
  const source = usable.length > 0 ? usable : samples;

  const nose = averagePoints(source.map((lm) => getPoint(lm, LM.nose)));
  const leftEar = averagePoints(source.map((lm) => getPoint(lm, LM.leftEar)));
  const rightEar = averagePoints(source.map((lm) => getPoint(lm, LM.rightEar)));
  const leftShoulder = averagePoints(source.map((lm) => getPoint(lm, LM.leftShoulder)));
  const rightShoulder = averagePoints(source.map((lm) => getPoint(lm, LM.rightShoulder)));

  const earMid = mid(leftEar, rightEar);
  const shoulderMid = mid(leftShoulder, rightShoulder);
  const shoulderWidth = Math.max(Math.abs(leftShoulder.x - rightShoulder.x), 1e-3);

  return {
    shoulderWidth,
    shoulderMid,
    earMid,
    nose,
    earShoulderDist: shoulderMid.y - earMid.y,
    noseOffsetX: nose.x - earMid.x,
  };
}
