import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccuracyRing } from '../components/AccuracyRing';
import { CameraView } from '../components/CameraView';
import { DemoFigure } from '../components/DemoFigure';
import { VolumeControl } from '../components/VolumeControl';
import { playChime, playComplete, playDing } from '../audio/sfx';
import { speak } from '../audio/voice';
import { getExercise } from '../data/exercises';
import { evaluateExercise, feedbackFor, scoreLevel, smoothScore } from '../lib/evaluate';
import type { AmbientHandle } from '../audio/ambient';
import type { Baseline, SessionResult, Settings, Step } from '../lib/types';
import type { UsePose } from '../hooks/usePose';
import { useSessionTimer } from '../hooks/useSessionTimer';

interface SessionProps {
  steps: Step[];
  baseline: Baseline | null;
  timerOnly: boolean;
  settings: Settings;
  ambient: AmbientHandle | null;
  pose: UsePose;
  onFinish: (result: SessionResult) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
}

const OVERLAY_COLORS = {
  good: '#2f7d5d',
  warn: '#c8a02a',
  bad: '#8a8f8b',
} as const;

function formatSec(total: number): string {
  const safe = Math.max(0, Math.round(total));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${`${seconds}`.padStart(2, '0')}`;
}

interface ScoreBucket {
  sum: number;
  count: number;
}

export function Session({
  steps,
  baseline,
  timerOnly,
  settings,
  ambient,
  pose,
  onFinish,
  onVolumeChange,
  onToggleMute,
}: SessionProps) {
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState('준비하세요');
  const [presenceLost, setPresenceLost] = useState(false);

  const scoreBucketsRef = useRef<ScoreBucket[]>(steps.map(() => ({ sum: 0, count: 0 })));
  const emaRef = useRef<number | null>(null);
  const dingedRef = useRef(false);
  const returnSpokenRef = useRef(-1);
  const finishedRef = useRef(false);

  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const totalSec = useMemo(
    () => steps.reduce((sum, step) => sum + step.prepSec + step.holdSec, 0),
    [steps],
  );

  const announce = useCallback(
    (text: string) => {
      if (!settings.voiceOn) return;
      speak(text, {
        onStart: () => ambient?.duck(true),
        onEnd: () => ambient?.duck(false),
      });
    },
    [ambient, settings.voiceOn],
  );

  const handleFinish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    const exercises = steps.map((step, index) => {
      const bucket = scoreBucketsRef.current[index];
      const count = timerOnly ? 0 : (bucket?.count ?? 0);
      const measured = count > 0;
      return {
        exerciseId: step.exerciseId,
        name: getExercise(step.exerciseId).name,
        side: step.side,
        score: measured ? (bucket?.sum ?? 0) / count : 0,
        measured,
      };
    });

    // 건너뛴 동작은 평균에서 제외한다.
    const measuredItems = exercises.filter((item) => item.measured);
    const averageScore =
      measuredItems.length === 0
        ? 0
        : measuredItems.reduce((sum, item) => sum + item.score, 0) / measuredItems.length;

    playComplete(ambient?.context ?? null);
    if (settings.voiceOn) speak('수고하셨습니다');
    onFinishRef.current({
      minutes: Math.max(1, Math.round(totalSec / 60)),
      totalSec,
      averageScore,
      exercises,
      timerOnly,
    });
  }, [ambient, settings.voiceOn, steps, timerOnly, totalSec]);

  const handleStepChange = useCallback(
    (index: number, step: Step) => {
      emaRef.current = null;
      dingedRef.current = false;
      returnSpokenRef.current = -1;
      setScore(0);
      const exercise = getExercise(step.exerciseId);
      setFeedback(
        step.side === 'left'
          ? '반대쪽도 같은 방법으로 따라 해 보세요'
          : '시범 그림을 보고 자세를 맞춰 주세요',
      );
      if (index > 0) playChime(ambient?.context ?? null);
      const prefix = step.side === 'left' ? '반대쪽. ' : '';
      announce(`${prefix}${exercise.name}. ${exercise.steps[0] ?? ''}`);
    },
    [ambient, announce],
  );

  const timer = useSessionTimer(steps, {
    onStepChange: handleStepChange,
    onFinish: handleFinish,
  });

  const { stepIndex, phase, paused } = timer;
  const currentStep = steps[stepIndex];
  const exercise = currentStep ? getExercise(currentStep.exerciseId) : null;

  useEffect(() => {
    if (timerOnly || !baseline || pose.status !== 'ready' || !currentStep) return;

    const bucket = scoreBucketsRef.current[stepIndex];
    const id = window.setInterval(() => {
      const now = performance.now();
      setPresenceLost(now - pose.lastSeenRef.current > 3000);

      const landmarks = pose.landmarksRef.current;
      if (!landmarks) {
        pose.overlayColorRef.current = OVERLAY_COLORS.bad;
        setScore(0);
        setFeedback('화면에 보이지 않아요. 카메라 앞으로 돌아와 주세요');
        return;
      }

      const evaluation = evaluateExercise(
        currentStep.exerciseId,
        landmarks,
        baseline,
        currentStep.side,
      );
      emaRef.current = smoothScore(emaRef.current, evaluation.score);
      const smoothed = emaRef.current;

      setScore(smoothed);
      setFeedback(feedbackFor(evaluation, smoothed));
      pose.overlayColorRef.current = OVERLAY_COLORS[scoreLevel(smoothed)];

      if (phase === 'hold' && bucket) {
        bucket.sum += smoothed;
        bucket.count += 1;
      }

      if (smoothed >= 0.8 && !dingedRef.current) {
        dingedRef.current = true;
        playDing(ambient?.context ?? null);
      }
    }, 200);

    return () => window.clearInterval(id);
  }, [
    ambient,
    baseline,
    currentStep,
    phase,
    pose.lastSeenRef,
    pose.landmarksRef,
    pose.overlayColorRef,
    pose.status,
    stepIndex,
    timerOnly,
  ]);

  useEffect(() => {
    if (timerOnly || !baseline) {
      setFeedback('카메라 없이 진행 중입니다. 시범 그림을 따라 해 보세요');
    }
  }, [baseline, timerOnly]);

  // 유지 종료 3초 전 안내
  useEffect(() => {
    if (phase !== 'hold' || timer.phaseRemaining > 3) return;
    if (returnSpokenRef.current === stepIndex) return;
    returnSpokenRef.current = stepIndex;
    announce('천천히 돌아옵니다');
  }, [announce, phase, stepIndex, timer.phaseRemaining]);

  // 일시정지 시 음악 페이드아웃
  useEffect(() => {
    if (!ambient || !settings.musicOn) return;
    if (paused) {
      ambient.stop();
    } else {
      void ambient.start();
    }
  }, [ambient, paused, settings.musicOn]);

  // 탭이 가려지면 자동 일시정지
  useEffect(() => {
    const onVisibility = (): void => {
      if (document.hidden) timer.pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [timer.pause]);

  const confirmExit = useCallback(() => {
    if (window.confirm('스트레칭을 종료하고 결과 화면으로 이동할까요?')) {
      handleFinish();
    }
  }, [handleFinish]);

  // 키보드: 스페이스 일시정지, → 건너뛰기, Esc 종료
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (event.code === 'Space') {
        event.preventDefault();
        timer.toggle();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        timer.skip();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        confirmExit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmExit, timer.skip, timer.toggle]);

  if (!currentStep || !exercise) {
    return <main className="screen session" />;
  }

  const level = timerOnly ? 'info' : scoreLevel(score);
  const sideLabel =
    currentStep.side === 'right' ? '오른쪽' : currentStep.side === 'left' ? '왼쪽' : null;
  const isBreathe = currentStep.exerciseId === 'breathe';

  return (
    <main className="screen session">
      <header className="session__top">
        <div className="session__progress">
          진행 <strong>{stepIndex + 1}</strong> / {steps.length}
        </div>
        <div className="session__top-actions">
          <VolumeControl
            volume={settings.volume}
            muted={settings.muted}
            onVolumeChange={onVolumeChange}
            onToggleMute={onToggleMute}
            compact
          />
          <button type="button" className="button button--ghost" onClick={confirmExit}>
            종료
          </button>
        </div>
      </header>

      <div className="session__grid">
        <section className="session__demo" aria-labelledby="exercise-title">
          <p className="eyebrow">{exercise.target}</p>
          <h1 id="exercise-title">
            {exercise.name}
            {sideLabel && <span className="session__side">{sideLabel}</span>}
          </h1>
          <DemoFigure demo={exercise.demo} side={currentStep.side} />
          {isBreathe && phase === 'hold' && (
            <div className="breath">
              <div className="breath__circle" aria-hidden="true" />
              <p className="breath__label">4초 들이마시고 6초 내쉬기</p>
            </div>
          )}
          <ol className="session__instructions">
            {exercise.steps.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
          <p className="session__caution">{exercise.caution}</p>
        </section>

        <section className="session__camera">
          {timerOnly ? (
            <div className="session__timer-only">
              <p className="eyebrow">타이머 모드</p>
              <p>카메라 없이 진행하고 있어요.</p>
              <p className="session__timer-only-note">
                시범 그림과 안내에 맞춰 천천히 따라 해 보세요.
              </p>
            </div>
          ) : (
            <CameraView
              videoRef={pose.videoRef}
              canvasRef={pose.canvasRef}
              message={presenceLost ? '화면에 보이지 않아요' : paused ? '일시정지됨' : null}
            />
          )}
        </section>

        <aside className="session__status">
          {timerOnly ? (
            <p className="session__timer-badge">타이머 모드</p>
          ) : (
            <AccuracyRing score={score} label="정확도" />
          )}
          <p className={`feedback feedback--${level}`}>{feedback}</p>

          <div className="session__times">
            <div>
              <span>동작 남은 시간</span>
              <strong>{formatSec(timer.stepRemaining)}</strong>
            </div>
            <div>
              <span>전체 남은 시간</span>
              <strong>{formatSec(timer.totalRemaining)}</strong>
            </div>
          </div>

          {phase === 'prep' && (
            <div className="session__prep">
              <span className="session__prep-label">준비</span>
              <span className="session__prep-value">{timer.phaseRemaining}</span>
            </div>
          )}

          <p className="session__keys">스페이스: 일시정지 · →: 건너뛰기 · Esc: 종료</p>
        </aside>
      </div>

      <footer className="session__controls">
        <button
          type="button"
          className="button button--primary"
          onClick={timer.toggle}
          aria-label={paused ? '재개' : '일시정지'}
        >
          {paused ? '재개' : '일시정지'}
        </button>
        <button type="button" className="button" onClick={timer.skip}>
          건너뛰기
        </button>
        <button type="button" className="button" onClick={confirmExit}>
          종료
        </button>
      </footer>

      {paused && (
        <div className="session__paused-overlay" role="status">
          <p>일시정지됨</p>
          <button type="button" className="button button--primary" onClick={timer.resume}>
            계속하기
          </button>
        </div>
      )}
    </main>
  );
}
