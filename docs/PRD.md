# PRD — 선생님용 스트레칭 프로그램 ("쉬는 시간 스트레칭")

- 작성: Claude · 2026-11-14
- 구현 담당: opencode (big-pickle → 한도 시 zai-coding-plan/glm-5.3-flash)
- 검증·수정: Claude

## 1. 목적

교사가 쉬는 시간에 **의자에 앉은 채로**, 노트북 웹캠 앞에서 1~10분 동안 상체 스트레칭을 따라 하는 웹앱.
카메라로 자세를 인식해 **동작이 정확한지 실시간으로 알려 주고**, 잔잔한 음악과 음성 안내를 제공한다.

## 2. 사용 흐름 (화면 4개, 라우터 없이 상태 전환)

1. **홈(Home)** — 시간 설정(1~10분, 1분 단위 슬라이더 + 빠른 선택 1·3·5·10분), 음악 켜기/음량, 음성 안내 켜기, 선택된 시간에 따른 루틴 미리보기(동작 이름 목록), "시작하기" 버튼. 개인정보 문구: "카메라 영상은 이 기기 안에서만 처리되며 어디에도 전송·저장되지 않습니다."
2. **카메라 맞추기(Setup)** — 카메라 권한 요청 → 거울 모드 영상 + 가이드 실루엣(머리·어깨 윤곽) → 힌지(화면 각도)·거리 안내 → 조건을 2초 연속 만족하면 기준 자세(baseline) 저장 → 3·2·1 카운트다운 후 자동 시작.
3. **세션(Session)** — 왼쪽: 시범 그림 + 동작 이름 + 방법 설명 / 가운데: 거울 영상 + 스켈레톤 오버레이 / 정확도 링, 피드백 문구, 동작 남은 시간, 전체 남은 시간, 진행 표시(n/N), 일시정지·건너뛰기·종료, 음량.
4. **결과(Summary)** — 총 시간, 평균 정확도, 동작별 정확도 막대, 격려 문구, 오늘 완료 횟수·연속 일수(localStorage), "다시 하기" / "처음으로".

## 3. 기능 요구사항

### 3.1 시간 설정
- 1~10분 정수. 기본 3분. 마지막 선택값·음량·음성 설정은 localStorage에 저장.

### 3.2 카메라 위치 설정 (힌지 조절)
MediaPipe 랜드마크(정규화 좌표, y는 아래로 증가) 기준. 모든 조건을 체크리스트로 화면에 표시(✓/✗)하고, 불만족 항목 중 **우선순위가 가장 높은 것 하나**를 큰 글씨 안내문으로 보여 준다.

| 순위 | 조건 | 불만족 시 안내 |
|---|---|---|
| 1 | 사람이 감지됨 (코·양 어깨 visibility ≥ 0.6) | "카메라 앞에 앉아 주세요" |
| 2 | 코 y가 0.22~0.45 | 코 y < 0.22(머리가 화면 위쪽에 치우침, 머리 위 공간 부족): "화면을 **뒤로** 조금 젖혀 주세요" / 코 y > 0.45: "화면을 **앞으로** 조금 세워 주세요" |
| 3 | 어깨 중점 y가 0.45~0.72 | 위와 같은 방향 규칙(작으면 뒤로 젖히기, 크면 앞으로 세우기) |
| 4 | 어깨 너비(양 어깨 x 거리)가 0.22~0.42 | 좁으면 "조금 더 가까이 앉아 주세요", 넓으면 "조금 뒤로 물러나 주세요" |
| 5 | 어깨 중점 x가 0.40~0.60 | "화면 가운데로 이동해 주세요" |
| 6 | 어깨 기울기 ≤ 6° | "어깨를 수평으로, 바르게 앉아 주세요" |

- 방향 문구는 실제 카메라로 반대일 경우를 대비해 `src/lib/setupCheck.ts`의 상수 한 곳에서만 정의한다.
- 조건 모두 만족 상태가 2초 지속되면 그 구간의 평균값으로 **baseline** 저장: `shoulderWidth`, `shoulderMid`, `earMid`, `nose`, `earShoulderDist`(귀 중점~어깨 중점 세로 거리), `noseOffsetX`(코 x − 귀 중점 x).
- 카메라 권한 거부·카메라 없음 → 안내 후 **"카메라 없이 따라 하기(타이머 모드)"** 버튼 제공. 타이머 모드에서는 판정 없이 안내·타이머·음악만 동작.
- "이대로 시작" 수동 버튼도 제공(사람이 감지된 상태에서만 활성).

### 3.3 자세 인식과 정확도 판정
- `@mediapipe/tasks-vision`의 `PoseLandmarker`(lite 모델, VIDEO 모드, numPoses 1, GPU delegate 실패 시 CPU).
- **자체 호스팅**: wasm은 `scripts/copy-mediapipe.mjs`가 `node_modules/@mediapipe/tasks-vision/wasm` → `public/mediapipe/wasm`으로 복사(`predev`, `prebuild`에서 실행, 복사본은 .gitignore). 모델은 `public/models/pose_landmarker_lite.task`로 내려받아 커밋 (https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task).
- 영상은 CSS `scaleX(-1)`로 거울 표시. **계산은 항상 원본(비반전) 좌표**로 한다. 오버레이 캔버스도 같은 CSS 반전을 적용.
- 좌우 규칙: 랜드마크 "left/right"는 **사용자 본인 기준**. 카메라를 마주 보면 사용자의 오른쪽은 원본 이미지에서 x가 작은 쪽이다. 화면 안내의 "오른쪽/왼쪽"은 항상 사용자 본인 기준.
- 모든 거리는 baseline `shoulderWidth`(이하 SW)로 나눠 정규화.
- 각 동작은 순수 함수 `evaluate(landmarks, baseline, side) → { score: 0~1, checks: [{ id, ok, progress: 0~1, hint }] }`. `score`는 checks의 progress 가중 평균. 필요한 랜드마크의 visibility가 0.5 미만이면 해당 check는 progress 0, hint "팔이 화면에 보이도록 해 주세요" 류.
- 프레임 점수는 EMA(α≈0.25)로 평활.
- 상태 표시: ≥ 0.8 "좋아요! 그대로 유지하세요"(초록) / 0.5~0.8 불만족 check 중 progress가 가장 낮은 것의 hint(노랑) / < 0.5 "시범 그림을 보고 자세를 맞춰 주세요" + hint(회색).
- 스켈레톤 색도 상태에 따라 변경. 정확도 링은 평활 점수를 표시.
- 동작 정확도 = 유지 구간(hold) 동안 평활 점수의 평균. **타이머는 정확도와 무관하게 진행**(설정 시간 보장).
- 정확 상태에 처음 진입할 때 부드러운 "딩" 효과음 1회.

### 3.4 동작 목록 (상체 12종 + 마무리)
임계값은 모두 `src/data/exercises.ts`에 상수로 모아 실기 튜닝이 쉽게 한다. 각도는 도(°). `side`가 있는 동작은 오른쪽→왼쪽 순.

| id | 이름 | 좌우 | 판정 기준(목표) |
|---|---|---|---|
| neck-tilt | 목 옆으로 기울이기 | ○ | 귀선(오른귀→왼귀) 기울기가 해당 방향으로 ≥ 20° · 어깨 기울기 ≤ 8°("어깨는 내리고 고개만 기울이세요") |
| neck-turn | 목 좌우 돌리기 | ○ | (코 x − 귀 중점 x)/SW 가 baseline 대비 해당 방향으로 ≥ 0.12 변화 · 어깨 기울기 ≤ 8° |
| neck-down | 고개 숙여 목 뒤 늘리기 | – | (어깨 중점 y − 코 y)/SW 가 baseline 대비 ≥ 0.15 감소 · 어깨 기울기 ≤ 8° |
| shoulder-shrug | 어깨 으쓱 올렸다 유지 | – | 귀-어깨 세로 거리/SW 가 baseline 대비 ≥ 0.07 감소 |
| overhead-reach | 깍지 끼고 위로 기지개 | – | 양 손목이 코보다 0.3SW 이상 위 · 양 팔꿈치 각도 ≥ 150° · 손목 간 거리 ≤ 0.6SW |
| side-bend | 옆구리 늘리기 | ○ | 반대쪽 손목이 코보다 위 · 어깨선이 해당 방향으로 ≥ 10° 기울어짐 (오른쪽으로 기울일 때 왼팔을 올림) |
| cross-arm | 팔 가슴 앞으로 당기기 | ○ | 해당 팔 손목이 반대쪽 어깨 x를 넘어감 · 팔꿈치 y가 어깨 y ± 0.4SW · 팔꿈치 각도 ≥ 130° |
| triceps | 팔꿈치 머리 뒤로 당기기 | ○ | 해당 팔 팔꿈치가 같은 쪽 귀보다 위 · 팔꿈치 각도 ≤ 100° |
| chest-open | 손 머리 뒤, 가슴 열기 | – | 양 손목이 각각 같은 쪽 귀에서 0.6SW 이내 · 팔꿈치 간 거리 ≥ 1.8SW |
| arms-wide | 양팔 벌려 가슴 펴기 | – | 손목 간 거리 ≥ 2.8SW · 양 손목 y가 어깨 y ± 0.4SW · 양 팔꿈치 각도 ≥ 150° |
| back-round | 깍지 끼고 앞으로 밀며 등 말기 | – | 손목 간 거리 ≤ 0.5SW · 손목 중점이 어깨 중점에서 가로 0.4SW, 세로 0.6SW 이내 · 코가 baseline 대비 0.08SW 이상 내려감 |
| torso-twist | 앉아서 몸통 비틀기 | ○ | 현재 어깨 너비/SW ≤ 0.82 · 코 x가 해당 방향으로 어깨 중점에서 벗어남 |
| breathe | 바른 자세로 심호흡(마무리) | – | 어깨 기울기 ≤ 5° · 코 x가 어깨 중점 ± 0.15SW · 4초 들숨/6초 날숨 호흡 원 애니메이션 |

각 동작 데이터: `id, name, target(부위), steps[](2~3줄), caution, hasSides, holdSec 기본값, priority, demo`.
- **시범 그림**: 동작마다 스틱 피겨 관절 좌표(`demo`: 머리·목·어깨·팔꿈치·손목·골반)를 데이터로 정의하고 `DemoFigure` 컴포넌트가 SVG로 그린다. 중립 자세 ↔ 목표 자세를 2초 주기로 부드럽게 오가는 애니메이션. 좌우 동작은 좌표를 반전해 사용(화면은 거울 기준이므로 "오른쪽" 동작은 화면 오른쪽으로 움직이게).

### 3.5 루틴 구성 (`src/lib/routine.ts`, 순수 함수)
- `buildRoutine(minutes) → Step[]`, `Step = { exerciseId, side?, prepSec, holdSec }`.
- 한 슬롯 = 준비 5초(안내·시범) + 유지 holdSec. 좌우 동작은 2슬롯.
- 순서 원칙: 목 → 어깨 → 팔·가슴 → 옆구리·등·몸통 → 마무리(breathe). 2분 이상이면 마지막은 항상 breathe(30초).
- 시간이 짧으면 priority 높은 동작만 선택(1분: neck-tilt 좌우 + overhead-reach 정도). 길면 전체 포함 후 holdSec를 15~30초 범위에서 조절, 그래도 남으면 2회전.
- **불변식**: 모든 step의 (prepSec + holdSec) 합 = minutes × 60 (정확히 일치, 마지막 step에서 보정). holdSec ≥ 10.

### 3.6 음악·음성·효과음 (`src/audio/`)
- **생성형 앰비언트**(Web Audio API, 음원 파일 없음): 느린 패드(사인/삼각파 3~4성부, 로우패스 필터, 8~10초 간격 코드 진행 예: Cmaj7 → Am7 → Fmaj7 → G6, 어택·릴리스 3초 이상) + 가끔 울리는 펜타토닉 벨 음(피드백 딜레이). 마스터 게인, 시작·종료 시 2초 페이드.
- AudioContext는 "시작하기" 클릭(사용자 제스처)에서 생성/resume. 일시정지 시 음악도 페이드아웃.
- 음량 슬라이더(0~100), 음소거 토글.
- **음성 안내**(Web Speech API, `ko-KR`, 미지원 시 조용히 생략): 동작 시작 시 "이름 + 첫 단계", 좌우 전환 "반대쪽", 유지 종료 3초 전 "천천히 돌아옵니다", 세션 종료 "수고하셨습니다". 말하는 동안 음악 게인을 살짝 낮춤(ducking).
- 효과음: 동작 전환 종소리, 정확 진입 "딩".

### 3.7 세션 제어
- 일시정지/재개(스페이스), 건너뛰기(→), 종료(Esc, 확인 후 결과 화면).
- 탭이 가려지면(visibilitychange) 자동 일시정지.
- 유지 중 사람이 3초 이상 감지되지 않으면 "화면에 보이지 않아요" 표시(타이머는 계속).

### 3.8 안전
- 홈 화면 하단 고정 문구: "통증이 느껴지면 즉시 멈추세요. 반동 없이 천천히, 숨을 참지 마세요."
- 각 동작 caution 표시.

## 4. 비기능 요구사항
- **스택**: Vite + React 18+ + TypeScript(strict). 상태 관리는 React 훅만. CSS는 일반 CSS(변수 사용), 외부 UI 라이브러리 금지. 의존성은 `@mediapipe/tasks-vision` 외 최소화.
- **배포**: 정적 사이트(Vercel, 프레임워크 프리셋 Vite, 출력 `dist`). 서버 코드 없음.
- **브라우저**: 최신 Chrome/Edge(노트북). 화면 폭 1024px 이상 최적화, 768px까지 깨지지 않게.
- **성능**: 추론 루프는 `requestVideoFrameCallback`(없으면 rAF), 목표 ≥ 15fps. 카메라 640×480 요청. React 리렌더는 초당 10회 이하로 제한(점수는 ref + 스로틀).
- **디자인**: 차분한 톤(세이지 그린/크림), 큰 글씨, 한국어 UI, 시스템 폰트(Pretendard 계열 fallback). `prefers-reduced-motion` 존중.
- **이미지**: 배경 등 이미지 파일은 Canva로 제작해 Claude가 `public/images/`에 넣는다. 홈·결과 화면 배경은 `public/images/bg-1.jpg`~`bg-5.jpg` 5장 중 하나를 **접속할 때마다 무작위로**(직전 배경 제외) 골라 CSS 변수 `--bg-image`로 적용한다(`src/lib/background.ts`). 파일이 없어도 보기 좋도록 그라데이션 fallback과 글자 가독성을 위한 반투명 오버레이를 둔다. 이미지를 직접 만들거나 내려받지 말 것.
- **접근성**: 버튼 aria-label, 키보드 조작, 색 + 문구 병행.
- **개인정보**: 영상·랜드마크를 네트워크로 보내지 않음. 분석 도구 없음.
- 화면 unmount·종료 시 카메라 트랙 stop, AudioContext 정리, speechSynthesis cancel.

## 5. 코드 구조
```
index.html
scripts/copy-mediapipe.mjs
public/models/pose_landmarker_lite.task
src/
  main.tsx, App.tsx (화면 상태 머신), styles.css
  screens/  Home.tsx, Setup.tsx, Session.tsx, Summary.tsx
  components/ CameraView.tsx(영상+오버레이), DemoFigure.tsx, AccuracyRing.tsx, VolumeControl.tsx
  hooks/  usePose.ts(카메라+PoseLandmarker), useSessionTimer.ts
  lib/   geometry.ts(각도·거리·기울기), setupCheck.ts, evaluate.ts(동작별 판정), routine.ts, storage.ts, types.ts
  data/  exercises.ts
  audio/ ambient.ts, sfx.ts, voice.ts
  lib/__tests__/ geometry.test.ts, routine.test.ts, evaluate.test.ts, setupCheck.test.ts
```

## 6. 테스트 (vitest)
- `routine`: 1~10분 모두에서 총합 = minutes×60, holdSec ≥ 10, 2분 이상 마지막이 breathe, 좌우 동작은 오른쪽·왼쪽이 연속으로 쌍을 이룸.
- `geometry`: 각도·기울기 부호(오른쪽 기울기/왼쪽 기울기) 검증.
- `evaluate`: 동작마다 합성 랜드마크로 "목표 자세 → score ≥ 0.8", "중립 자세 → score < 0.5", 좌우 동작은 반대 방향 자세가 낮은 점수.
- `setupCheck`: 각 불만족 조건이 올바른 안내를 내는지.
- `npm run build`(tsc 포함), `npm test` 모두 통과해야 완료.

## 7. 완료 기준
1. `npm install && npm run build && npm test` 성공.
2. `npm run dev`로 홈 → 카메라 맞추기 → 세션 → 결과 전 과정이 오류 없이 동작(카메라 없을 때 타이머 모드 포함).
3. 설정한 시간과 실제 세션 길이가 일치.
4. 음악이 시작 버튼 이후 재생되고 음량 조절·음소거 동작.

## 8. 범위 밖
계정/서버 저장, 하체 동작 판정, 모바일 최적화, 다국어.
