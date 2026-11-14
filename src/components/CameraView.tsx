import type { ReactNode, RefObject } from 'react';

interface CameraViewProps {
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  showGuide?: boolean;
  message?: string | null;
  footer?: ReactNode;
}

export function CameraView({ videoRef, canvasRef, showGuide = false, message, footer }: CameraViewProps) {
  return (
    <div className="camera-view">
      <div className="camera-view__frame">
        <video
          ref={videoRef}
          className="camera-view__video"
          muted
          playsInline
          aria-label="카메라 영상 (거울 모드)"
        />
        <canvas ref={canvasRef} className="camera-view__canvas" aria-hidden="true" />
        {showGuide && (
          <svg
            className="camera-view__guide"
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <circle cx="50" cy="26" r="11" />
            <path d="M22 70 Q22 50 42 48 L58 48 Q78 50 78 70" />
          </svg>
        )}
        {message && <p className="camera-view__message">{message}</p>}
      </div>
      {footer && <div className="camera-view__footer">{footer}</div>}
    </div>
  );
}
