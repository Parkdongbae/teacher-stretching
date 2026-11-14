import { getExercise } from '../data/exercises';
import { buildRoutine } from '../lib/routine';
import type { Settings } from '../lib/types';
import { VolumeControl } from '../components/VolumeControl';

interface HomeProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onStart: () => void;
}

const QUICK_MINUTES = [1, 3, 5, 10];

interface PreviewGroup {
  id: string;
  name: string;
  sides: number;
}

function previewGroups(minutes: number): PreviewGroup[] {
  const groups: PreviewGroup[] = [];
  for (const step of buildRoutine(minutes)) {
    const last = groups[groups.length - 1];
    if (last && last.id === step.exerciseId) {
      if (step.side) last.sides += 1;
      continue;
    }
    groups.push({
      id: step.exerciseId,
      name: getExercise(step.exerciseId).name,
      sides: step.side ? 1 : 0,
    });
  }
  return groups;
}

export function Home({ settings, onChange, onStart }: HomeProps) {
  const groups = previewGroups(settings.minutes);

  return (
    <main className="screen home">
      <div className="home__backdrop" aria-hidden="true" />
      <div className="home__content">
        <header className="home__header">
          <p className="eyebrow">쉬는 시간 스트레칭</p>
          <h1>
            선생님을 위한
            <br />
            상체 스트레칭
          </h1>
          <p className="lede">
            의자에 앉은 채로, 노트북 화면 앞에서 1~10분.
            <br />
            카메라가 자세를 보고 부드럽게 알려 드려요.
          </p>
        </header>

        <section className="card" aria-labelledby="time-heading">
          <div className="card__head">
            <h2 id="time-heading">시간</h2>
            <strong className="time-value">{settings.minutes}분</strong>
          </div>
          <input
            className="time-slider"
            type="range"
            min={1}
            max={10}
            step={1}
            value={settings.minutes}
            onChange={(event) => onChange({ minutes: Number(event.target.value) })}
            aria-label="스트레칭 시간(분)"
          />
          <div className="quick-times">
            {QUICK_MINUTES.map((minute) => (
              <button
                key={minute}
                type="button"
                className={settings.minutes === minute ? 'chip chip--active' : 'chip'}
                onClick={() => onChange({ minutes: minute })}
                aria-pressed={settings.minutes === minute}
              >
                {minute}분
              </button>
            ))}
          </div>
        </section>

        <section className="card" aria-labelledby="sound-heading">
          <div className="card__head">
            <h2 id="sound-heading">소리</h2>
          </div>
          <div className="setting-row">
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.musicOn}
                onChange={(event) => onChange({ musicOn: event.target.checked })}
              />
              <span>잔잔한 음악</span>
            </label>
            <VolumeControl
              volume={settings.volume}
              muted={settings.muted}
              onVolumeChange={(volume) => onChange({ volume })}
              onToggleMute={() => onChange({ muted: !settings.muted })}
              compact
            />
          </div>
          <div className="setting-row">
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.voiceOn}
                onChange={(event) => onChange({ voiceOn: event.target.checked })}
              />
              <span>음성 안내</span>
            </label>
            <span className="setting-hint">동작 이름과 순서를 한국어로 알려 드려요</span>
          </div>
        </section>

        <section className="card" aria-labelledby="routine-heading">
          <div className="card__head">
            <h2 id="routine-heading">오늘의 루틴</h2>
            <span className="card__meta">{groups.length}가지 동작</span>
          </div>
          <ol className="routine-preview">
            {groups.map((group, index) => (
              <li key={`${group.id}-${index}`}>
                <span className="routine-preview__index">{index + 1}</span>
                <span className="routine-preview__name">{group.name}</span>
                {group.sides >= 2 && <span className="routine-preview__badge">좌우</span>}
              </li>
            ))}
          </ol>
        </section>

        <div className="home__actions">
          <button type="button" className="button button--primary button--wide" onClick={onStart}>
            시작하기
          </button>
          <p className="privacy">
            카메라 영상은 이 기기 안에서만 처리되며 어디에도 전송·저장되지 않습니다.
          </p>
        </div>

        <p className="safety">통증이 느껴지면 즉시 멈추세요. 반동 없이 천천히, 숨을 참지 마세요.</p>
      </div>
    </main>
  );
}
