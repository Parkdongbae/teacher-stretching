import { useEffect, useState } from 'react';
import type { Exercise, ExerciseId, Instructor, Side } from '../lib/types';
import { DemoFigure } from './DemoFigure';

interface DemoPhotoProps {
  exerciseId: ExerciseId;
  side?: Side;
  instructor: Instructor;
  demo: Exercise['demo'];
  name: string;
}

export function instructorPhoto(instructor: Instructor, exerciseId: ExerciseId): string {
  return `/images/instructors/${instructor}/${exerciseId}.jpg`;
}

/**
 * 실제 강사가 동작을 보여 주는 시범 사진.
 * 사진은 모두 "오른쪽" 동작(거울 화면 기준, 화면 오른쪽으로 움직임)으로 준비되어 있어
 * 왼쪽 동작은 좌우를 뒤집어 보여 준다. 사진을 불러오지 못하면 그림으로 대신한다.
 */
export function DemoPhoto({ exerciseId, side, instructor, demo, name }: DemoPhotoProps) {
  const [failed, setFailed] = useState(false);
  const src = instructorPhoto(instructor, exerciseId);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) {
    return <DemoFigure demo={demo} side={side} />;
  }

  return (
    <figure className="demo-photo">
      <img
        key={src}
        className={side === 'left' ? 'demo-photo__img demo-photo__img--flipped' : 'demo-photo__img'}
        src={src}
        alt={`${name} 시범 사진`}
        onError={() => setFailed(true)}
      />
      <figcaption className="demo-photo__badges">
        <span className="demo-photo__badge">거울처럼 따라 하세요</span>
        {side && (
          <span className="demo-photo__badge demo-photo__badge--side">
            {side === 'right' ? '오른쪽 →' : '← 왼쪽'}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
