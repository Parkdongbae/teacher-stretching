import { useEffect, useRef } from 'react';
import type { DemoPose, Point, Side } from '../lib/types';

type Key = keyof DemoPose;

const SIZE = 120;
/** 한 주기: 중립 → 목표로 이동 → 목표 유지 → 중립으로 복귀 */
const CYCLE_MS = 3600;
const MOVE_END = 0.3;
const HOLD_END = 0.72;
const RETURN_END = 0.92;

const ARMS: Array<{ shoulder: Key; elbow: Key; wrist: Key }> = [
  { shoulder: 'shoulderR', elbow: 'elbowR', wrist: 'wristR' },
  { shoulder: 'shoulderL', elbow: 'elbowL', wrist: 'wristL' },
];

interface DemoFigureProps {
  demo: { from: DemoPose; to: DemoPose };
  side?: Side;
  className?: string;
}

function mirrored(point: Point, mirror: boolean): Point {
  return mirror ? { x: SIZE - point.x, y: point.y } : point;
}

function ease(t: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));
}

/** 주기 위치(0~1) → 목표 자세 쪽 진행도(0~1) */
function progressAt(phase: number): number {
  if (phase < MOVE_END) return ease(phase / MOVE_END);
  if (phase < HOLD_END) return 1;
  if (phase < RETURN_END) return 1 - ease((phase - HOLD_END) / (RETURN_END - HOLD_END));
  return 0;
}

function fmt(point: Point): string {
  return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
}

function armPath(pose: Record<Key, Point>, arm: (typeof ARMS)[number]): string {
  return `M${fmt(pose[arm.shoulder])} L${fmt(pose[arm.elbow])} L${fmt(pose[arm.wrist])}`;
}

function torsoPath(pose: Record<Key, Point>): string {
  return `M${fmt(pose.shoulderR)} L${fmt(pose.shoulderL)} L${fmt(pose.hipL)} L${fmt(pose.hipR)} Z`;
}

function neckPath(pose: Record<Key, Point>): string {
  return `M${fmt(pose.neck)} L${fmt(pose.head)}`;
}

function resolve(from: DemoPose, to: DemoPose, mirror: boolean, progress: number): Record<Key, Point> {
  const pose = {} as Record<Key, Point>;
  for (const key of Object.keys(from) as Key[]) {
    const start = mirrored(from[key], mirror);
    const end = mirrored(to[key], mirror);
    pose[key] = {
      x: start.x + (end.x - start.x) * progress,
      y: start.y + (end.y - start.y) * progress,
    };
  }
  return pose;
}

export function DemoFigure({ demo, side, className }: DemoFigureProps) {
  const torsoRef = useRef<SVGPathElement>(null);
  const neckRef = useRef<SVGPathElement>(null);
  const headRef = useRef<SVGCircleElement>(null);
  const noseRef = useRef<SVGCircleElement>(null);
  const armRefs = useRef<Array<SVGPathElement | null>>([]);
  const handRefs = useRef<Array<SVGCircleElement | null>>([]);

  const mirror = side === 'left';
  const ghost = resolve(demo.from, demo.from, mirror, 0);

  useEffect(() => {
    const apply = (progress: number): void => {
      const pose = resolve(demo.from, demo.to, mirror, progress);
      torsoRef.current?.setAttribute('d', torsoPath(pose));
      neckRef.current?.setAttribute('d', neckPath(pose));
      headRef.current?.setAttribute('cx', pose.head.x.toFixed(1));
      headRef.current?.setAttribute('cy', pose.head.y.toFixed(1));
      noseRef.current?.setAttribute('cx', pose.nose.x.toFixed(1));
      noseRef.current?.setAttribute('cy', pose.nose.y.toFixed(1));
      ARMS.forEach((arm, index) => {
        armRefs.current[index]?.setAttribute('d', armPath(pose, arm));
        const hand = handRefs.current[index];
        hand?.setAttribute('cx', pose[arm.wrist].x.toFixed(1));
        hand?.setAttribute('cy', pose[arm.wrist].y.toFixed(1));
      });
    };

    apply(1);

    if (
      typeof window === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    let frame = 0;
    const startTime = performance.now();
    const step = (now: number): void => {
      apply(progressAt(((now - startTime) % CYCLE_MS) / CYCLE_MS));
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame);
  }, [demo, mirror]);

  return (
    <svg
      className={className ? `demo-figure ${className}` : 'demo-figure'}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label="시범 동작 그림 (거울처럼 따라 하세요)"
    >
      {/* 의자 */}
      <path className="demo-figure__chair" d="M36 92 H84 M42 92 V112 M78 92 V112" />

      {/* 기준(바른) 자세를 옅게 표시 */}
      <g className="demo-figure__ghost">
        <path d={torsoPath(ghost)} />
        {ARMS.map((arm) => (
          <path key={arm.wrist} d={armPath(ghost, arm)} />
        ))}
        <circle cx={ghost.head.x} cy={ghost.head.y} r={10} />
      </g>

      <path ref={torsoRef} className="demo-figure__torso" />
      <path ref={neckRef} className="demo-figure__neck" />
      {ARMS.map((arm, index) => (
        <path
          key={arm.wrist}
          ref={(element) => {
            armRefs.current[index] = element;
          }}
          className="demo-figure__arm"
        />
      ))}
      {ARMS.map((arm, index) => (
        <circle
          key={arm.wrist}
          ref={(element) => {
            handRefs.current[index] = element;
          }}
          className="demo-figure__hand"
          r={4.2}
        />
      ))}
      <circle ref={headRef} className="demo-figure__head" r={10} />
      <circle ref={noseRef} className="demo-figure__nose" r={1.8} />
    </svg>
  );
}
