interface AccuracyRingProps {
  score: number;
  size?: number;
  label?: string;
}

const STROKE = 10;

export function AccuracyRing({ score, size = 132, label = '정확도' }: AccuracyRingProps) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(score) ? score : 0));
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.round(clamped * 100);
  const level = clamped >= 0.8 ? 'good' : clamped >= 0.5 ? 'warn' : 'bad';

  return (
    <div className={`accuracy-ring accuracy-ring--${level}`} role="img" aria-label={`${label} ${percent}퍼센트`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          className="accuracy-ring__track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={STROKE}
        />
        <circle
          className="accuracy-ring__value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={STROKE}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="accuracy-ring__text">
        <span className="accuracy-ring__percent">{percent}%</span>
        <span className="accuracy-ring__label">{label}</span>
      </div>
    </div>
  );
}
