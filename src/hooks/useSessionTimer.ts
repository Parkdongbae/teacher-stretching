import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Step } from '../lib/types';

export type SessionPhase = 'prep' | 'hold' | 'done';

export interface TimerSnapshot {
  stepIndex: number;
  phase: SessionPhase;
  phaseRemaining: number;
  stepRemaining: number;
  totalRemaining: number;
  elapsed: number;
  paused: boolean;
}

export interface SessionTimer extends TimerSnapshot {
  pause: () => void;
  resume: () => void;
  toggle: () => void;
  skip: () => void;
}

interface TimerOptions {
  onStepChange?: (index: number, step: Step) => void;
  onPhaseChange?: (phase: Exclude<SessionPhase, 'done'>, index: number) => void;
  onFinish?: () => void;
}

const TICK_MS = 250;

export function useSessionTimer(steps: Step[], options: TimerOptions = {}): SessionTimer {
  const offsets = useMemo(() => {
    const result: number[] = [];
    let cursor = 0;
    for (const step of steps) {
      result.push(cursor);
      cursor += step.prepSec + step.holdSec;
    }
    return result;
  }, [steps]);

  const totalSec = useMemo(
    () => steps.reduce((sum, step) => sum + step.prepSec + step.holdSec, 0),
    [steps],
  );

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const elapsedRef = useRef(0);
  const lastTickRef = useRef(0);
  const pausedRef = useRef(false);
  const finishedRef = useRef(false);
  const indexRef = useRef(0);
  const prevIndexRef = useRef(-1);
  const prevPhaseRef = useRef<SessionPhase>('prep');

  const initialStep = steps[0];
  const [snapshot, setSnapshot] = useState<TimerSnapshot>({
    stepIndex: 0,
    phase: 'prep',
    phaseRemaining: initialStep?.prepSec ?? 0,
    stepRemaining: initialStep ? initialStep.prepSec + initialStep.holdSec : 0,
    totalRemaining: totalSec,
    elapsed: 0,
    paused: false,
  });

  useEffect(() => {
    elapsedRef.current = 0;
    lastTickRef.current = performance.now();
    pausedRef.current = false;
    finishedRef.current = false;
    indexRef.current = 0;
    prevIndexRef.current = -1;
    prevPhaseRef.current = 'prep';

    const emit = (): void => {
      const elapsed = elapsedRef.current;
      let index = 0;
      for (let i = 0; i < steps.length; i += 1) {
        index = i;
        const end = offsets[i] + steps[i].prepSec + steps[i].holdSec;
        if (elapsed < end) break;
      }

      const step = steps[index];
      const stepStart = offsets[index];
      const holdStart = stepStart + step.prepSec;
      const stepEnd = holdStart + step.holdSec;
      const done = finishedRef.current || elapsed >= totalSec;
      const phase: SessionPhase = done ? 'done' : elapsed < holdStart ? 'prep' : 'hold';

      if (index !== prevIndexRef.current) {
        prevIndexRef.current = index;
        optionsRef.current.onStepChange?.(index, step);
      }
      if (phase !== 'done' && phase !== prevPhaseRef.current) {
        prevPhaseRef.current = phase;
        optionsRef.current.onPhaseChange?.(phase, index);
      }
      if (phase === 'done' && !finishedRef.current) {
        finishedRef.current = true;
        optionsRef.current.onFinish?.();
      }

      indexRef.current = index;
      setSnapshot({
        stepIndex: index,
        phase,
        phaseRemaining: Math.max(
          0,
          Math.ceil((phase === 'prep' ? holdStart : stepEnd) - elapsed),
        ),
        stepRemaining: Math.max(0, Math.ceil(stepEnd - elapsed)),
        totalRemaining: Math.max(0, Math.ceil(totalSec - elapsed)),
        elapsed,
        paused: pausedRef.current,
      });
    };

    emit();
    const id = setInterval(() => {
      const now = performance.now();
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      if (!pausedRef.current && !finishedRef.current) {
        elapsedRef.current = Math.min(totalSec, elapsedRef.current + delta);
      }
      emit();
    }, TICK_MS);

    return () => clearInterval(id);
  }, [steps, offsets, totalSec]);

  const pause = useCallback(() => {
    if (finishedRef.current || pausedRef.current) return;
    pausedRef.current = true;
    lastTickRef.current = performance.now();
    setSnapshot((prev) => ({ ...prev, paused: true }));
  }, []);

  const resume = useCallback(() => {
    if (finishedRef.current || !pausedRef.current) return;
    pausedRef.current = false;
    lastTickRef.current = performance.now();
    setSnapshot((prev) => ({ ...prev, paused: false }));
  }, []);

  const toggle = useCallback(() => {
    if (pausedRef.current) {
      resume();
    } else {
      pause();
    }
  }, [pause, resume]);

  const skip = useCallback(() => {
    if (finishedRef.current) return;
    const next = indexRef.current + 1;
    elapsedRef.current = next >= steps.length ? totalSec : (offsets[next] ?? totalSec);
    lastTickRef.current = performance.now();
  }, [offsets, steps.length, totalSec]);

  return { ...snapshot, pause, resume, toggle, skip };
}
