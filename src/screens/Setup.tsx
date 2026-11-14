import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraView } from '../components/CameraView';
import { playChime } from '../audio/sfx';
import { computeBaseline } from '../lib/geometry';
import { checkSetup } from '../lib/setupCheck';
import type { Baseline, Landmarks, SetupResult } from '../lib/types';
import type { UsePose } from '../hooks/usePose';

interface SetupProps {
  pose: UsePose;
  onReady: (baseline: Baseline | null, timerOnly: boolean) => void;
  onBack: () => void;
}

const SAMPLE_MS = 150;
const HOLD_MS = 2000;

export function Setup({ pose, onReady, onBack }: SetupProps) {
  const [check, setCheck] = useState<SetupResult | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);

  const samplesRef = useRef<Landmarks[]>([]);
  const heldSinceRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const baselineRef = useRef<Baseline | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    void pose.start();
  }, [pose.start]);

  const beginCountdown = useCallback((baseline: Baseline) => {
    if (countdownRef.current !== null) return;
    baselineRef.current = baseline;
    countdownRef.current = 3;
    setCountdown(3);
    playChime();

    const step = (): void => {
      const current = countdownRef.current;
      if (current === null) return;
      const next = current - 1;
      countdownRef.current = next;
      if (next <= 0) {
        setCountdown(0);
        onReadyRef.current(baselineRef.current, false);
        return;
      }
      setCountdown(next);
      timeoutRef.current = window.setTimeout(step, 1000);
    };
    timeoutRef.current = window.setTimeout(step, 1000);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (countdownRef.current !== null) return;
      const landmarks = pose.landmarksRef.current;
      if (!landmarks) {
        // 사람이 안 보일 때도 "카메라 앞에 앉아 주세요" 안내와 체크리스트를 보여 준다.
        setCheck(pose.status === 'ready' ? checkSetup([]) : null);
        heldSinceRef.current = null;
        samplesRef.current = [];
        setHoldProgress(0);
        return;
      }

      const result = checkSetup(landmarks);
      setCheck(result);

      if (result.ok) {
        if (heldSinceRef.current === null) {
          heldSinceRef.current = performance.now();
          samplesRef.current = [];
        }
        samplesRef.current.push(landmarks);
        if (samplesRef.current.length > 30) samplesRef.current.shift();
        const held = performance.now() - heldSinceRef.current;
        setHoldProgress(Math.min(1, held / HOLD_MS));
        if (held >= HOLD_MS) {
          beginCountdown(computeBaseline(samplesRef.current));
        }
      } else {
        heldSinceRef.current = null;
        samplesRef.current = [];
        setHoldProgress(0);
      }
    }, SAMPLE_MS);

    return () => window.clearInterval(id);
  }, [beginCountdown, pose.landmarksRef, pose.status]);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  const startManual = (): void => {
    const landmarks = pose.landmarksRef.current;
    const samples =
      samplesRef.current.length > 0 ? samplesRef.current : landmarks ? [landmarks] : [];
    if (samples.length === 0) return;
    onReady(computeBaseline(samples), false);
  };

  const status = pose.status;
  const personVisible = check?.personVisible ?? false;

  return (
    <main className="screen setup">
      <header className="screen__header">
        <button type="button" className="button button--ghost" onClick={onBack}>
          이전
        </button>
        <div>
          <p className="eyebrow">카메라 맞추기</p>
          <h1>화면과 자리를 맞춰 주세요</h1>
        </div>
      </header>

      <div className="setup__grid">
        <section className="setup__camera">
          <CameraView
            videoRef={pose.videoRef}
            canvasRef={pose.canvasRef}
            showGuide={status === 'ready'}
            message={countdown !== null && countdown > 0 ? `곧 시작합니다 · ${countdown}` : null}
          />
          <p className="setup__hint">
            노트북 화면 각도를 조절해 머리와 어깨가 점선 안에 들어오도록 맞춰 주세요.
          </p>
          <ul className="setup__tips">
            <li>화면에서 팔 길이(50~70cm)만큼 떨어져 앉으면 팔 동작까지 잘 보여요.</li>
            <li>머리 위로 손을 뻗을 공간이 화면에 조금 남아야 해요.</li>
            <li>창문을 등지면 얼굴이 어두워져요. 빛이 앞에서 오게 앉아 주세요.</li>
          </ul>
        </section>

        <section className="setup__panel" aria-live="polite">
          {status === 'loading' && (
            <p className="setup__loading">카메라와 자세 인식을 준비하고 있어요…</p>
          )}

          {status === 'error' && (
            <div className="setup__error">
              <h2>카메라를 사용할 수 없어요</h2>
              <p>{pose.error}</p>
              <div className="setup__error-actions">
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => void pose.start()}
                >
                  다시 시도
                </button>
                <button type="button" className="button" onClick={() => onReady(null, true)}>
                  카메라 없이 따라 하기(타이머 모드)
                </button>
              </div>
            </div>
          )}

          {status !== 'error' && (
            <>
              <p className="setup__primary-hint">
                {countdown !== null
                  ? countdown > 0
                    ? `${countdown}초 뒤에 시작합니다`
                    : '시작합니다'
                  : check?.ok
                    ? '좋아요! 그대로 잠시만 유지해 주세요'
                    : (check?.primaryHint ?? '자세를 확인하는 중이에요')}
              </p>

              <ul className="setup__checklist">
                {(check?.conditions ?? []).map((condition) => (
                  <li key={condition.id} className={condition.ok ? 'is-ok' : 'is-bad'}>
                    <span className="setup__mark" aria-hidden="true">
                      {condition.ok ? '✓' : '✗'}
                    </span>
                    <span>{condition.label}</span>
                    <span className="visually-hidden">
                      {condition.ok ? '조건 만족' : '조건 불만족'}
                    </span>
                  </li>
                ))}
              </ul>

              {holdProgress > 0 && countdown === null && (
                <div className="setup__hold" aria-hidden="true">
                  <div
                    className="setup__hold-bar"
                    style={{ width: `${Math.round(holdProgress * 100)}%` }}
                  />
                </div>
              )}

              <div className="setup__actions">
                <button
                  type="button"
                  className="button button--primary"
                  onClick={startManual}
                  disabled={!personVisible || countdown !== null}
                >
                  이대로 시작
                </button>
                <p className="setup__note">조건을 2초 동안 유지하면 자동으로 시작합니다.</p>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
