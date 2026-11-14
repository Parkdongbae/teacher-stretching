interface VolumeControlProps {
  volume: number;
  muted: boolean;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  compact?: boolean;
}

export function VolumeControl({
  volume,
  muted,
  onVolumeChange,
  onToggleMute,
  compact = false,
}: VolumeControlProps) {
  return (
    <div className={compact ? 'volume-control volume-control--compact' : 'volume-control'}>
      <button
        type="button"
        className="volume-control__mute"
        onClick={onToggleMute}
        aria-label={muted ? '음소거 해제' : '음소거'}
        aria-pressed={muted}
      >
        {muted ? '소리 꺼짐' : '소리 켜짐'}
      </button>
      <label className="volume-control__slider">
        <span className="visually-hidden">음량</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={volume}
          onChange={(event) => onVolumeChange(Number(event.target.value))}
          aria-label="음량"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={volume}
        />
      </label>
      {!compact && <span className="volume-control__value">{volume}</span>}
    </div>
  );
}
