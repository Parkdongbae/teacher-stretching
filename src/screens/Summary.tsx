import type { SessionResult } from '../lib/types';
import type { CompletionStats } from '../lib/storage';

interface SummaryProps {
  result: SessionResult;
  stats: CompletionStats;
  onRestart: () => void;
  onHome: () => void;
}

function formatSec(total: number): string {
  const safe = Math.max(0, Math.round(total));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}분 ${`${seconds}`.padStart(2, '0')}초`;
}

function encouragement(result: SessionResult): string {
  if (result.timerOnly) return '타이머 모드로 끝까지 해냈어요. 다음에는 카메라와 함께해 보세요.';
  if (result.averageScore >= 0.8) return '아주 좋아요! 자세를 끝까지 잘 유지했어요.';
  if (result.averageScore >= 0.5) return '잘했어요. 다음에는 조금 더 천천히 자세를 맞춰 보세요.';
  return '오늘은 여기까지! 내일은 시범 그림을 보며 천천히 따라 해 봐요.';
}

export function Summary({ result, stats, onRestart, onHome }: SummaryProps) {
  const percent = Math.round(result.averageScore * 100);
  const sideLabel = (side?: 'left' | 'right'): string =>
    side === 'right' ? '오른쪽' : side === 'left' ? '왼쪽' : '';

  return (
    <main className="screen summary">
      <div className="summary__backdrop" aria-hidden="true" />
      <div className="summary__content">
        <header className="summary__header">
          <p className="eyebrow">오늘의 스트레칭 완료</p>
          <h1>수고하셨습니다</h1>
          <p className="lede">{encouragement(result)}</p>
        </header>

        <section className="summary__stats" aria-label="세션 요약">
          <div className="summary__stat">
            <span>총 시간</span>
            <strong>{formatSec(result.totalSec)}</strong>
          </div>
          <div className="summary__stat">
            <span>평균 정확도</span>
            <strong>{result.timerOnly ? '—' : `${percent}%`}</strong>
          </div>
        </section>

        {!result.timerOnly && (
          <section className="card" aria-labelledby="accuracy-heading">
            <div className="card__head">
              <h2 id="accuracy-heading">동작별 정확도</h2>
            </div>
            <ul className="accuracy-bars">
              {result.exercises.map((item, index) => (
                <li key={`${item.exerciseId}-${item.side ?? 'none'}-${index}`}>
                  <span className="accuracy-bars__name">
                    {item.name}
                    {item.side && <em>{sideLabel(item.side)}</em>}
                  </span>
                  <span className="accuracy-bars__track">
                    <span
                      className="accuracy-bars__fill"
                      style={{ width: `${item.measured ? Math.round(item.score * 100) : 0}%` }}
                    />
                  </span>
                  <span className="accuracy-bars__value">
                    {item.measured ? `${Math.round(item.score * 100)}%` : '건너뜀'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card summary__streak" aria-labelledby="streak-heading">
          <div className="card__head">
            <h2 id="streak-heading">이어지는 기록</h2>
          </div>
          <div className="summary__streak-values">
            <div>
              <span>오늘 완료</span>
              <strong>{stats.todayCount}회</strong>
            </div>
            <div>
              <span>연속 일수</span>
              <strong>{stats.streakDays}일</strong>
            </div>
          </div>
        </section>

        <div className="summary__actions">
          <button type="button" className="button button--primary" onClick={onRestart}>
            다시 하기
          </button>
          <button type="button" className="button" onClick={onHome}>
            처음으로
          </button>
        </div>

        <p className="safety">통증이 느껴지면 즉시 멈추세요. 반동 없이 천천히, 숨을 참지 마세요.</p>
      </div>
    </main>
  );
}
