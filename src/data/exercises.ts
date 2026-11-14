import type { DemoPose, Exercise, ExerciseId } from '../lib/types';

/**
 * 동작 판정에 쓰이는 임계값(도/정규화 거리).
 * 실기 튜닝은 이 상수만 고치면 된다.
 */
export const THRESHOLDS = {
  neckTilt: { minTilt: 20, shoulderMax: 8 },
  neckTurn: { minShift: 0.12 },
  neckDown: { minDrop: 0.15 },
  shoulderShrug: { minRise: 0.07 },
  overheadReach: { minAbove: 0.3, minElbow: 150, maxWristGap: 0.6 },
  sideBend: { minTilt: 10 },
  crossArm: { minElbow: 130, elbowY: 0.4 },
  triceps: { maxElbow: 100 },
  chestOpen: { maxEarDist: 0.6, minElbowGap: 1.8 },
  armsWide: { minWristGap: 2.8, maxHeightDiff: 0.4, minElbow: 150 },
  backRound: { maxWristGap: 0.5, maxHorizontal: 0.4, maxVertical: 0.6, minHeadDrop: 0.08 },
  torsoTwist: { maxWidthRatio: 0.82 },
  breathe: { maxShoulderTilt: 5, maxNoseOffset: 0.15 },
} as const;

/**
 * 시범 그림 기준 자세 (120 x 120, 거울 화면 기준).
 * 아래 자세는 모두 "오른쪽" 동작이며, x 가 큰 쪽(화면 오른쪽, 이름 끝 L)이 사용자의 오른쪽이다.
 * 왼쪽 동작은 DemoFigure 가 좌우를 뒤집어 그린다.
 */
const NEUTRAL: DemoPose = {
  head: { x: 60, y: 20 },
  nose: { x: 60, y: 23 },
  neck: { x: 60, y: 34 },
  shoulderL: { x: 76, y: 42 },
  shoulderR: { x: 44, y: 42 },
  elbowL: { x: 80, y: 60 },
  elbowR: { x: 40, y: 60 },
  wristL: { x: 82, y: 78 },
  wristR: { x: 38, y: 78 },
  hipL: { x: 68, y: 88 },
  hipR: { x: 52, y: 88 },
};

function pose(overrides: Partial<DemoPose>): DemoPose {
  return { ...NEUTRAL, ...overrides };
}

const demo = (to: DemoPose, from: DemoPose = NEUTRAL) => ({ from, to });

export const EXERCISES: Exercise[] = [
  {
    id: 'neck-tilt',
    name: '목 옆으로 기울이기',
    target: '목 옆',
    steps: [
      '숨을 내쉬며 고개를 한쪽으로 천천히 기울입니다.',
      '어깨는 내린 채, 귀가 어깨에 가까워지도록 합니다.',
      '그 자리에서 3번 천천히 호흡합니다.',
    ],
    caution: '고개를 뒤로 젖히거나 손으로 머리를 누르지 마세요.',
    hasSides: true,
    holdSec: 20,
    priority: 10,
    demo: demo(
      pose({ head: { x: 70, y: 23 }, nose: { x: 71, y: 26 }, neck: { x: 61, y: 34 } }),
    ),
  },
  {
    id: 'neck-turn',
    name: '목 좌우 돌리기',
    target: '목',
    steps: [
      '턱을 살짝 당기고 고개를 한쪽으로 돌립니다.',
      '어깨는 정면을 향한 채로 유지합니다.',
      '시선은 어깨 너머를 편하게 봅니다.',
    ],
    caution: '빠르게 돌리지 말고, 통증이 있으면 멈추세요.',
    hasSides: true,
    holdSec: 20,
    priority: 8,
    demo: demo(
      pose({ head: { x: 62, y: 20 }, nose: { x: 69, y: 23 } }),
    ),
  },
  {
    id: 'neck-down',
    name: '고개 숙여 목 뒤 늘리기',
    target: '목 뒤',
    steps: [
      '숨을 내쉬며 턱을 가슴 쪽으로 천천히 당깁니다.',
      '양 어깨는 내리고 힘을 뺍니다.',
      '목 뒤가 늘어나는 느낌에서 멈춥니다.',
    ],
    caution: '턱을 세게 당기지 말고 무리하지 마세요.',
    hasSides: false,
    holdSec: 15,
    priority: 4,
    demo: demo(
      pose({ head: { x: 60, y: 25 }, nose: { x: 60, y: 31 } }),
    ),
  },
  {
    id: 'shoulder-shrug',
    name: '어깨 으쓱 올렸다 유지',
    target: '어깨',
    steps: [
      '양 어깨를 귀 쪽으로 천천히 올립니다.',
      '올린 자세에서 3번 호흡합니다.',
      '숨을 내쉬며 어깨를 툭 내려놓습니다.',
    ],
    caution: '어깨를 올릴 때 목에 힘을 주지 마세요.',
    hasSides: false,
    holdSec: 15,
    priority: 7,
    demo: demo(
      pose({
        shoulderL: { x: 76, y: 34 },
        shoulderR: { x: 44, y: 34 },
        elbowL: { x: 80, y: 52 },
        elbowR: { x: 40, y: 52 },
        wristL: { x: 82, y: 70 },
        wristR: { x: 38, y: 70 },
      }),
    ),
  },
  {
    id: 'overhead-reach',
    name: '깍지 끼고 위로 기지개',
    target: '어깨·등',
    steps: [
      '손가락을 깍지 끼고 손바닥을 위로 향합니다.',
      '숨을 들이마시며 양팔을 머리 위로 뻗습니다.',
      '옆구리와 등이 길게 늘어나도록 유지합니다.',
    ],
    caution: '어깨가 아프면 팔을 완전히 펴지 않아도 됩니다.',
    hasSides: false,
    holdSec: 20,
    priority: 9,
    demo: demo(
      pose({
        elbowL: { x: 78, y: 20 },
        elbowR: { x: 42, y: 20 },
        wristL: { x: 62, y: 6 },
        wristR: { x: 58, y: 6 },
      }),
    ),
  },
  {
    id: 'side-bend',
    name: '옆구리 늘리기',
    target: '옆구리',
    steps: [
      '반대쪽 팔을 머리 위로 들어 올립니다.',
      '상체를 천천히 옆으로 기울입니다.',
      '골반은 의자에 붙인 채 유지합니다.',
    ],
    caution: '허리를 비틀지 말고 옆으로만 기울이세요.',
    hasSides: true,
    holdSec: 20,
    priority: 5,
    demo: demo(
      pose({
        head: { x: 71, y: 23 },
        nose: { x: 72, y: 26 },
        neck: { x: 66, y: 36 },
        shoulderL: { x: 80, y: 49 },
        shoulderR: { x: 50, y: 39 },
        elbowL: { x: 87, y: 65 },
        wristL: { x: 85, y: 81 },
        elbowR: { x: 49, y: 19 },
        wristR: { x: 68, y: 8 },
      }),
    ),
  },
  {
    id: 'cross-arm',
    name: '팔 가슴 앞으로 당기기',
    target: '어깨 뒤',
    steps: [
      '한쪽 팔을 가슴 앞으로 뻗습니다.',
      '반대쪽 손으로 팔꿈치를 몸 쪽으로 당깁니다.',
      '어깨가 올라가지 않게 유지합니다.',
    ],
    caution: '팔꿈치를 꺾어 세게 누르지 마세요.',
    hasSides: true,
    holdSec: 20,
    priority: 4,
    demo: demo(
      pose({
        elbowL: { x: 60, y: 48 },
        wristL: { x: 40, y: 46 },
        elbowR: { x: 38, y: 60 },
        wristR: { x: 56, y: 53 },
      }),
    ),
  },
  {
    id: 'triceps',
    name: '팔꿈치 머리 뒤로 당기기',
    target: '팔 뒤',
    steps: [
      '한쪽 팔을 들어 손을 등 뒤로 넘깁니다.',
      '반대쪽 손으로 팔꿈치를 부드럽게 당깁니다.',
      '갈비뼈가 들리지 않게 유지합니다.',
    ],
    caution: '팔꿈치를 세게 잡아당기지 마세요.',
    hasSides: true,
    holdSec: 20,
    priority: 3,
    demo: demo(
      pose({
        elbowL: { x: 74, y: 16 },
        wristL: { x: 63, y: 31 },
        elbowR: { x: 46, y: 21 },
        wristR: { x: 70, y: 14 },
      }),
    ),
  },
  {
    id: 'chest-open',
    name: '손 머리 뒤, 가슴 열기',
    target: '가슴',
    steps: [
      '손을 머리 뒤에 가볍게 댑니다.',
      '양 팔꿈치를 옆으로 넓게 벌립니다.',
      '숨을 들이마시며 가슴을 엽니다.',
    ],
    caution: '허리를 과하게 젖히지 마세요.',
    hasSides: false,
    holdSec: 20,
    priority: 6,
    demo: demo(
      pose({
        elbowL: { x: 99, y: 30 },
        elbowR: { x: 21, y: 30 },
        wristL: { x: 71, y: 21 },
        wristR: { x: 49, y: 21 },
      }),
    ),
  },
  {
    id: 'arms-wide',
    name: '양팔 벌려 가슴 펴기',
    target: '가슴·어깨',
    steps: [
      '양팔을 옆으로 넓게 뻗습니다.',
      '손바닥을 앞으로 향하게 합니다.',
      '어깨가 귀 쪽으로 올라가지 않게 합니다.',
    ],
    caution: '팔을 억지로 뒤로 젖히지 마세요.',
    hasSides: false,
    holdSec: 20,
    priority: 3,
    demo: demo(
      pose({
        elbowL: { x: 96, y: 44 },
        elbowR: { x: 24, y: 44 },
        wristL: { x: 110, y: 42 },
        wristR: { x: 10, y: 42 },
      }),
    ),
  },
  {
    id: 'back-round',
    name: '깍지 끼고 앞으로 밀며 등 말기',
    target: '등',
    steps: [
      '손가락을 깍지 끼고 팔을 앞으로 뻗습니다.',
      '등을 둥글게 말며 손을 앞으로 밀어냅니다.',
      '목 뒤가 길어지도록 고개를 숙입니다.',
    ],
    caution: '어깨가 아프면 팔을 조금만 뻗으세요.',
    hasSides: false,
    holdSec: 20,
    priority: 2,
    demo: demo(
      pose({
        head: { x: 60, y: 27 },
        nose: { x: 60, y: 33 },
        elbowL: { x: 73, y: 56 },
        elbowR: { x: 47, y: 56 },
        wristL: { x: 62, y: 62 },
        wristR: { x: 58, y: 62 },
      }),
    ),
  },
  {
    id: 'torso-twist',
    name: '앉아서 몸통 비틀기',
    target: '허리·옆구리',
    steps: [
      '골반은 정면에 둔 채 상체를 비틉니다.',
      '한쪽 손으로 의자 등받이를 가볍게 잡습니다.',
      '시선은 비트는 방향 뒤쪽을 봅니다.',
    ],
    caution: '허리를 세게 비틀지 말고 천천히 움직이세요.',
    hasSides: true,
    holdSec: 20,
    priority: 2,
    demo: demo(
      pose({
        head: { x: 63, y: 20 },
        nose: { x: 70, y: 23 },
        shoulderL: { x: 72, y: 43 },
        shoulderR: { x: 50, y: 42 },
        elbowL: { x: 77, y: 60 },
        wristL: { x: 79, y: 76 },
        elbowR: { x: 58, y: 57 },
        wristR: { x: 74, y: 68 },
      }),
    ),
  },
  {
    id: 'breathe',
    name: '바른 자세로 심호흡',
    target: '전신',
    steps: [
      '어깨를 내리고 등을 곧게 세웁니다.',
      '4초 동안 코로 들이마시고, 6초 동안 천천히 내쉽니다.',
      '호흡 원을 따라 편안하게 반복합니다.',
    ],
    caution: '숨을 참지 말고 편안한 속도로 하세요.',
    hasSides: false,
    holdSec: 30,
    priority: 10,
    demo: demo(
      pose({
        elbowL: { x: 78, y: 66 },
        elbowR: { x: 42, y: 66 },
        wristL: { x: 64, y: 72 },
        wristR: { x: 56, y: 72 },
      }),
    ),
  },
];

export const EXERCISE_MAP: Record<ExerciseId, Exercise> = EXERCISES.reduce(
  (acc, exercise) => {
    acc[exercise.id] = exercise;
    return acc;
  },
  {} as Record<ExerciseId, Exercise>,
);

export function getExercise(id: ExerciseId): Exercise {
  return EXERCISE_MAP[id];
}
