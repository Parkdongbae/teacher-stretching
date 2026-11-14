import { clamp } from './geometry';
import type { Settings } from './types';

const SETTINGS_KEY = 'stretching.settings.v1';
const HISTORY_KEY = 'stretching.history.v1';

export const DEFAULT_SETTINGS: Settings = {
  instructor: 'female',
  minutes: 3,
  volume: 60,
  musicOn: true,
  voiceOn: true,
  muted: false,
};

export interface HistoryEntry {
  date: string;
  seconds: number;
  accuracy: number;
}

export interface CompletionStats {
  todayCount: number;
  streakDays: number;
}

function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadSettings(): Settings {
  if (!hasStorage()) return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      instructor:
        parsed.instructor === 'female' || parsed.instructor === 'male'
          ? parsed.instructor
          : DEFAULT_SETTINGS.instructor,
      minutes:
        typeof parsed.minutes === 'number'
          ? clamp(Math.round(parsed.minutes), 1, 10)
          : DEFAULT_SETTINGS.minutes,
      volume:
        typeof parsed.volume === 'number'
          ? clamp(Math.round(parsed.volume), 0, 100)
          : DEFAULT_SETTINGS.volume,
      musicOn: typeof parsed.musicOn === 'boolean' ? parsed.musicOn : DEFAULT_SETTINGS.musicOn,
      voiceOn: typeof parsed.voiceOn === 'boolean' ? parsed.voiceOn : DEFAULT_SETTINGS.voiceOn,
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULT_SETTINGS.muted,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // 저장 공간이 없는 환경에서는 조용히 넘어간다.
  }
}

export function loadHistory(): HistoryEntry[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry) => typeof entry?.date === 'string' && typeof entry?.seconds === 'number',
    );
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(-120)));
  } catch {
    // 무시
  }
}

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDateKey(key: string, deltaDays: number): string {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + deltaDays);
  return localDateKey(date);
}

export function getStats(history: HistoryEntry[], today = localDateKey()): CompletionStats {
  const todayCount = history.filter((entry) => entry.date === today).length;

  const days = new Set(history.map((entry) => entry.date));
  let streakDays = 0;
  let cursor = days.has(today) ? today : shiftDateKey(today, -1);
  while (days.has(cursor)) {
    streakDays += 1;
    cursor = shiftDateKey(cursor, -1);
  }

  return { todayCount, streakDays };
}

export function recordCompletion(seconds: number, accuracy: number): CompletionStats {
  const history = loadHistory();
  history.push({ date: localDateKey(), seconds, accuracy });
  saveHistory(history);
  return getStats(history);
}
