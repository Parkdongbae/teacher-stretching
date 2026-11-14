// MediaPipe tasks-vision wasm 파일을 public/mediapipe/wasm 으로 복사한다.
// predev / prebuild 에서 실행되며, 복사본은 .gitignore 에 포함되어 있다.
import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const target = join(root, 'public', 'mediapipe', 'wasm');

async function main() {
  try {
    const info = await stat(source);
    if (!info.isDirectory()) {
      throw new Error('wasm 경로가 디렉터리가 아닙니다.');
    }
  } catch {
    console.warn('[copy-mediapipe] @mediapipe/tasks-vision 이 설치되어 있지 않아 복사를 건너뜁니다.');
    return;
  }

  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await cp(source, target, { recursive: true });
  console.log('[copy-mediapipe] wasm 파일을 public/mediapipe/wasm 으로 복사했습니다.');
}

main().catch((error) => {
  console.error('[copy-mediapipe] 복사 실패:', error);
  process.exitCode = 1;
});
