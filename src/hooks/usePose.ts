import { useCallback, useEffect, useRef, useState } from 'react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { allVisible, LM } from '../lib/geometry';
import type { Landmarks } from '../lib/types';

export type PoseStatus = 'idle' | 'loading' | 'ready' | 'error';

type FrameVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: (now: number) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

const CONNECTIONS: Array<[number, number]> = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [0, 11],
  [0, 12],
  [7, 11],
  [8, 12],
];

export interface UsePose {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  status: PoseStatus;
  error: string | null;
  landmarksRef: React.MutableRefObject<Landmarks | null>;
  lastSeenRef: React.MutableRefObject<number>;
  overlayColorRef: React.MutableRefObject<string>;
  start: () => Promise<void>;
  stop: () => void;
}

async function createLandmarker(): Promise<PoseLandmarker> {
  const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
  const options = {
    baseOptions: {
      modelAssetPath: '/models/pose_landmarker_lite.task',
      delegate: 'GPU' as const,
    },
    runningMode: 'VIDEO' as const,
    numPoses: 1,
  };
  try {
    return await PoseLandmarker.createFromOptions(vision, options);
  } catch {
    return await PoseLandmarker.createFromOptions(vision, {
      ...options,
      baseOptions: { ...options.baseOptions, delegate: 'CPU' as const },
    });
  }
}

function cameraErrorMessage(error: unknown): string {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return '카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라를 허용해 주세요.';
    }
    if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
      return '사용할 수 있는 카메라를 찾지 못했습니다.';
    }
  }
  return '카메라를 시작하지 못했습니다. 다른 앱에서 카메라를 쓰고 있지 않은지 확인해 주세요.';
}

export function usePose(): UsePose {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarksRef = useRef<Landmarks | null>(null);
  const lastSeenRef = useRef(0);
  const overlayColorRef = useRef('#2f7d5d');

  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const runningRef = useRef(false);
  const startingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const vfcRef = useRef<number | null>(null);
  const lastTimestampRef = useRef(0);

  const [status, setStatus] = useState<PoseStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const cancelLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const video = videoRef.current as FrameVideo | null;
    if (vfcRef.current !== null && video?.cancelVideoFrameCallback) {
      video.cancelVideoFrameCallback(vfcRef.current);
      vfcRef.current = null;
    }
  }, []);

  const draw = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    const landmarks = landmarksRef.current;
    if (!landmarks) return;

    const color = overlayColorRef.current;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    for (const [startIndex, endIndex] of CONNECTIONS) {
      const start = landmarks[startIndex];
      const end = landmarks[endIndex];
      if (!start || !end) continue;
      if ((start.visibility ?? 1) < 0.4 || (end.visibility ?? 1) < 0.4) continue;
      ctx.beginPath();
      ctx.moveTo(start.x * width, start.y * height);
      ctx.lineTo(end.x * width, end.y * height);
      ctx.stroke();
    }

    for (const index of [0, 7, 8, 11, 12, 13, 14, 15, 16]) {
      const point = landmarks[index];
      if (!point || (point.visibility ?? 1) < 0.4) continue;
      ctx.beginPath();
      ctx.arc(point.x * width, point.y * height, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, []);

  const tick = useCallback(() => {
    if (!runningRef.current) return;
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;

    // 화면이 바뀌면 <video> 요소가 새로 만들어지므로 스트림을 다시 연결한다.
    if (video && streamRef.current && video.srcObject !== streamRef.current) {
      video.srcObject = streamRef.current;
      void video.play().catch(() => undefined);
    }

    if (video && landmarker && video.readyState >= 2) {
      const timestamp = performance.now();
      if (timestamp > lastTimestampRef.current) {
        lastTimestampRef.current = timestamp;
        try {
          const result = landmarker.detectForVideo(video, timestamp);
          const detected = result.landmarks?.[0];
          if (detected && detected.length > 0) {
            landmarksRef.current = detected.map((point) => ({
              x: point.x,
              y: point.y,
              z: point.z,
              visibility: point.visibility,
            }));
            if (allVisible(landmarksRef.current, [LM.nose, LM.leftShoulder, LM.rightShoulder], 0.5)) {
              lastSeenRef.current = performance.now();
            }
          } else {
            landmarksRef.current = null;
          }
          draw();
        } catch {
          // 프레임 타이밍이 어긋난 경우 다음 프레임에서 다시 시도한다.
        }
      }
    }

    if (!runningRef.current) return;
    const frameVideo = video as FrameVideo | null;
    // 영상이 아직 재생 전이면 프레임 콜백이 오지 않으므로 rAF 로 기다린다.
    if (frameVideo?.requestVideoFrameCallback && frameVideo.readyState >= 2 && !frameVideo.paused) {
      vfcRef.current = frameVideo.requestVideoFrameCallback(() => {
        vfcRef.current = null;
        tick();
      });
    } else {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        tick();
      });
    }
  }, [draw]);

  const start = useCallback(async () => {
    if (runningRef.current || startingRef.current) return;
    startingRef.current = true;
    setStatus('loading');
    setError(null);

    try {
      if (!streamRef.current) {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('이 브라우저에서는 카메라를 사용할 수 없습니다.');
        }
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        });
        const video = videoRef.current;
        if (video) {
          video.srcObject = streamRef.current;
          await video.play().catch(() => undefined);
        }
      }

      if (!landmarkerRef.current) {
        landmarkerRef.current = await createLandmarker();
      }

      lastTimestampRef.current = 0;
      lastSeenRef.current = performance.now();
      runningRef.current = true;
      setStatus('ready');
      tick();
    } catch (caught) {
      setStatus('error');
      setError(caught instanceof Error && !(caught instanceof DOMException) ? caught.message : cameraErrorMessage(caught));
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    } finally {
      startingRef.current = false;
    }
  }, [tick]);

  const stop = useCallback(() => {
    runningRef.current = false;
    cancelLoop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
    landmarksRef.current = null;
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    setStatus('idle');
  }, [cancelLoop]);

  useEffect(() => () => stop(), [stop]);

  return {
    videoRef,
    canvasRef,
    status,
    error,
    landmarksRef,
    lastSeenRef,
    overlayColorRef,
    start,
    stop,
  };
}
