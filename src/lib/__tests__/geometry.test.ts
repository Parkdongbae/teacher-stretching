import { describe, expect, it } from 'vitest';
import {
  angleDeg,
  clamp,
  computeBaseline,
  dist,
  earTiltDeg,
  lineTiltDeg,
  LM,
  mid,
  normDist,
  shoulderTiltDeg,
} from '../geometry';
import type { Landmarks } from '../types';

function upright(): Landmarks {
  const points: Landmarks = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 0.99,
  }));
  const set = (index: number, x: number, y: number, visibility = 0.99): void => {
    points[index] = { x, y, visibility };
  };
  set(LM.nose, 0.5, 0.35);
  set(LM.leftEar, 0.57, 0.36);
  set(LM.rightEar, 0.43, 0.36);
  set(LM.leftShoulder, 0.65, 0.6);
  set(LM.rightShoulder, 0.35, 0.6);
  set(LM.leftElbow, 0.7, 0.76);
  set(LM.rightElbow, 0.3, 0.76);
  set(LM.leftWrist, 0.72, 0.9);
  set(LM.rightWrist, 0.28, 0.9);
  set(LM.leftHip, 0.62, 0.92);
  set(LM.rightHip, 0.38, 0.92);
  return points;
}

describe('기본 기하 함수', () => {
  it('dist 는 유클리드 거리를 돌려준다', () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('mid 는 두 점의 중점을 돌려준다', () => {
    expect(mid({ x: 0.1, y: 0.3 }, { x: 0.5, y: 0.9 })).toEqual({ x: 0.3, y: 0.6 });
  });

  it('clamp 는 범위를 벗어난 값을 잘라낸다', () => {
    expect(clamp(12, 1, 10)).toBe(10);
    expect(clamp(-3, 1, 10)).toBe(1);
    expect(clamp(4, 1, 10)).toBe(4);
  });

  it('angleDeg 는 세 점의 끼인각을 0~180도로 돌려준다', () => {
    expect(angleDeg({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(90, 5);
    expect(angleDeg({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(180, 5);
    expect(angleDeg({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(0);
  });

  it('normDist 는 기준 어깨 너비로 나눈다', () => {
    expect(normDist({ x: 0.2, y: 0.2 }, { x: 0.5, y: 0.2 }, 0.3)).toBeCloseTo(1, 6);
    expect(normDist({ x: 0.2, y: 0.2 }, { x: 0.5, y: 0.2 }, 0)).toBe(0);
  });
});

describe('좌우 기울기 부호 (사용자 오른쪽 = 이미지 x가 작은 쪽)', () => {
  it('lineTiltDeg: 오른쪽 점이 아래로 처지면 양수', () => {
    const tilt = lineTiltDeg({ x: 0.4, y: 0.7 }, { x: 0.6, y: 0.5 });
    expect(tilt).toBeCloseTo(45, 6);
    expect(tilt).toBeGreaterThan(0);
  });

  it('lineTiltDeg: 왼쪽 점이 아래로 처지면 음수', () => {
    const tilt = lineTiltDeg({ x: 0.4, y: 0.5 }, { x: 0.6, y: 0.7 });
    expect(tilt).toBeCloseTo(-45, 6);
    expect(tilt).toBeLessThan(0);
  });

  it('lineTiltDeg: 수직선은 90도', () => {
    expect(lineTiltDeg({ x: 0.5, y: 0.8 }, { x: 0.5, y: 0.5 })).toBe(90);
  });

  it('shoulderTiltDeg: 오른쪽 어깨가 낮으면 양수', () => {
    const landmarks = upright();
    landmarks[LM.rightShoulder] = { x: 0.35, y: 0.68, visibility: 0.99 };
    expect(shoulderTiltDeg(landmarks)).toBeGreaterThan(0);

    const mirrored = upright();
    mirrored[LM.leftShoulder] = { x: 0.65, y: 0.68, visibility: 0.99 };
    expect(shoulderTiltDeg(mirrored)).toBeLessThan(0);
  });

  it('earTiltDeg: 오른쪽 귀가 낮으면 양수', () => {
    const landmarks = upright();
    landmarks[LM.rightEar] = { x: 0.43, y: 0.44, visibility: 0.99 };
    expect(earTiltDeg(landmarks)).toBeGreaterThan(0);
  });
});

describe('computeBaseline', () => {
  it('정면 자세에서 어깨 너비와 중심을 계산한다', () => {
    const baseline = computeBaseline([upright()]);
    expect(baseline.shoulderWidth).toBeCloseTo(0.3, 6);
    expect(baseline.shoulderMid.x).toBeCloseTo(0.5, 6);
    expect(baseline.shoulderMid.y).toBeCloseTo(0.6, 6);
    expect(baseline.earMid.x).toBeCloseTo(0.5, 6);
    expect(baseline.earMid.y).toBeCloseTo(0.36, 6);
    expect(baseline.earShoulderDist).toBeCloseTo(0.24, 6);
    expect(baseline.noseOffsetX).toBeCloseTo(0, 6);
  });

  it('여러 프레임을 평균 내고 낮은 visibility 샘플은 제외한다', () => {
    const shifted = upright();
    shifted[LM.leftShoulder] = { x: 0.95, y: 0.4, visibility: 0 };
    shifted[LM.rightShoulder] = { x: 0.05, y: 0.4, visibility: 0 };
    shifted[LM.nose] = { x: 0.9, y: 0.1, visibility: 0 };

    const baseline = computeBaseline([upright(), shifted]);
    expect(baseline.shoulderWidth).toBeCloseTo(0.3, 6);
    expect(baseline.nose.x).toBeCloseTo(0.5, 6);
  });

  it('어깨 너비가 0 인 비정상 입력에서도 0으로 나누지 않는다', () => {
    const degenerate = upright();
    degenerate[LM.leftShoulder] = { x: 0.5, y: 0.6, visibility: 0.99 };
    degenerate[LM.rightShoulder] = { x: 0.5, y: 0.6, visibility: 0.99 };
    const baseline = computeBaseline([degenerate]);
    expect(Number.isFinite(baseline.shoulderWidth)).toBe(true);
    expect(baseline.shoulderWidth).toBeGreaterThan(0);
  });
});
