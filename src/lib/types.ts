export interface Point {
  x: number;
  y: number;
}

/** MediaPipe Pose 랜드마크 (정규화 좌표, y는 아래로 증가) */
export interface Landmark extends Point {
  z?: number;
  visibility?: number;
}

export type Landmarks = Landmark[];

export type Side = 'left' | 'right';

export type ExerciseId =
  | 'neck-tilt'
  | 'neck-turn'
  | 'neck-down'
  | 'shoulder-shrug'
  | 'overhead-reach'
  | 'side-bend'
  | 'cross-arm'
  | 'triceps'
  | 'chest-open'
  | 'arms-wide'
  | 'back-round'
  | 'torso-twist'
  | 'breathe';

/** 기준 자세. 모든 거리는 shoulderWidth 로 나누어 사용한다. */
export interface Baseline {
  shoulderWidth: number;
  shoulderMid: Point;
  earMid: Point;
  nose: Point;
  /** 귀 중점 ~ 어깨 중점 세로 거리 */
  earShoulderDist: number;
  /** 코 x - 귀 중점 x */
  noseOffsetX: number;
}

export interface PoseCheck {
  id: string;
  ok: boolean;
  progress: number;
  hint: string;
}

export interface Evaluation {
  score: number;
  checks: PoseCheck[];
}

export type EvaluateFn = (
  landmarks: Landmarks,
  baseline: Baseline,
  side?: Side,
) => Evaluation;

/**
 * 시범 그림 관절 좌표 (120×120, 거울 화면 기준).
 * 이름 끝의 L 은 화면 오른쪽에 그려지는 쪽으로, 거울처럼 보는 사용자의 "오른쪽" 팔·어깨다.
 * R 은 화면 왼쪽 = 사용자의 "왼쪽".
 */
export interface DemoPose {
  head: Point;
  /** 얼굴이 향하는 방향을 보여 주는 코 위치 */
  nose: Point;
  neck: Point;
  shoulderL: Point;
  shoulderR: Point;
  elbowL: Point;
  elbowR: Point;
  wristL: Point;
  wristR: Point;
  hipL: Point;
  hipR: Point;
}

export interface Exercise {
  id: ExerciseId;
  name: string;
  target: string;
  steps: string[];
  caution: string;
  hasSides: boolean;
  holdSec: number;
  priority: number;
  demo: { from: DemoPose; to: DemoPose };
}

export interface Step {
  exerciseId: ExerciseId;
  side?: Side;
  prepSec: number;
  holdSec: number;
}

export interface SetupCondition {
  id: string;
  label: string;
  ok: boolean;
}

export interface SetupResult {
  ok: boolean;
  personVisible: boolean;
  conditions: SetupCondition[];
  primaryHint: string | null;
}

export interface Settings {
  minutes: number;
  volume: number;
  musicOn: boolean;
  voiceOn: boolean;
  muted: boolean;
}

export interface ExerciseScore {
  exerciseId: ExerciseId;
  name: string;
  side?: Side;
  score: number;
  /** 유지 구간에서 실제로 판정이 이루어졌는지 (건너뛴 동작은 false) */
  measured: boolean;
}

export interface SessionResult {
  minutes: number;
  totalSec: number;
  averageScore: number;
  exercises: ExerciseScore[];
  timerOnly: boolean;
}
