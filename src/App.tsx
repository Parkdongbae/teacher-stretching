import { useCallback, useEffect, useRef, useState } from 'react';
import { createAmbient, type AmbientHandle } from './audio/ambient';
import { disposeSfx } from './audio/sfx';
import { cancelVoice } from './audio/voice';
import { usePose } from './hooks/usePose';
import { buildRoutine } from './lib/routine';
import {
  getStats,
  loadHistory,
  loadSettings,
  recordCompletion,
  saveSettings,
  type CompletionStats,
} from './lib/storage';
import type { Baseline, SessionResult, Settings, Step } from './lib/types';
import { Home } from './screens/Home';
import { Session } from './screens/Session';
import { Setup } from './screens/Setup';
import { Summary } from './screens/Summary';

type ScreenName = 'home' | 'setup' | 'session' | 'summary';

export default function App() {
  const [screen, setScreen] = useState<ScreenName>('home');
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [steps, setSteps] = useState<Step[]>([]);
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [timerOnly, setTimerOnly] = useState(false);
  const [result, setResult] = useState<SessionResult | null>(null);
  const [stats, setStats] = useState<CompletionStats>(() => getStats(loadHistory()));

  const pose = usePose();
  const ambientRef = useRef<AmbientHandle | null>(null);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    const ambient = ambientRef.current;
    if (!ambient) return;
    ambient.setVolume(settings.volume);
    ambient.setMuted(settings.muted);
  }, [settings.muted, settings.volume]);

  useEffect(
    () => () => {
      ambientRef.current?.dispose();
      ambientRef.current = null;
      disposeSfx();
      cancelVoice();
    },
    [],
  );

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const ensureAmbient = useCallback((): AmbientHandle => {
    if (!ambientRef.current) {
      ambientRef.current = createAmbient();
    }
    return ambientRef.current;
  }, []);

  const handleStart = useCallback(() => {
    setSteps(buildRoutine(settings.minutes));
    setBaseline(null);
    setTimerOnly(false);
    setResult(null);

    const ambient = ensureAmbient();
    ambient.setVolume(settings.volume);
    ambient.setMuted(settings.muted);
    if (settings.musicOn) {
      void ambient.start();
    }
    setScreen('setup');
  }, [ensureAmbient, settings.minutes, settings.musicOn, settings.muted, settings.volume]);

  const handleSetupReady = useCallback((nextBaseline: Baseline | null, onlyTimer: boolean) => {
    setBaseline(nextBaseline);
    setTimerOnly(onlyTimer);
    setScreen('session');
  }, []);

  const handleSetupBack = useCallback(() => {
    pose.stop();
    ambientRef.current?.stop();
    setScreen('home');
  }, [pose]);

  const handleFinish = useCallback(
    (sessionResult: SessionResult) => {
      setResult(sessionResult);
      setStats(recordCompletion(sessionResult.totalSec, sessionResult.averageScore));
      pose.stop();
      ambientRef.current?.stop();
      cancelVoice();
      setScreen('summary');
    },
    [pose],
  );

  const handleHome = useCallback(() => {
    pose.stop();
    ambientRef.current?.stop();
    cancelVoice();
    setScreen('home');
  }, [pose]);

  return (
    <div className="app">
      {screen === 'home' && (
        <Home settings={settings} onChange={updateSettings} onStart={handleStart} />
      )}

      {screen === 'setup' && (
        <Setup pose={pose} onReady={handleSetupReady} onBack={handleSetupBack} />
      )}

      {screen === 'session' && (
        <Session
          steps={steps}
          baseline={baseline}
          timerOnly={timerOnly}
          settings={settings}
          ambient={ambientRef.current}
          pose={pose}
          onFinish={handleFinish}
          onVolumeChange={(volume) => updateSettings({ volume })}
          onToggleMute={() => updateSettings({ muted: !settings.muted })}
        />
      )}

      {screen === 'summary' && result && (
        <Summary result={result} stats={stats} onRestart={handleStart} onHome={handleHome} />
      )}
    </div>
  );
}
