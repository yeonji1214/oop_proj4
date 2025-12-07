# Block Coding Frontend (React + Vite)

Spring Boot 백엔드(팀8 Block Coding Application)와 연동되는 블록 코딩 웹 클라이언트입니다. 블록 CRUD/연결/실행 및 실시간 WebSocket 출력 구독을 지원합니다.

## 주요 기능
- 블록 에디터: 팔레트에서 드래그 앤 드롭으로 블록 배치/연결/삭제
- 자동 동기화: 블록 추가/이동/삭제/값 변경 시 백엔드와 즉시 동기화
- 실행: `POST /api/execution/projects/{projectId}/run` 후 STOMP/SockJS로 `/topic/execution/{sessionId}` 구독하여 실시간 출력 표시
- 타입/필드 지원: START, IF, FOR, WHILE, PRINT, ALERT, DRAW, ADD, SUBTRACT, MULTIPLY, DIVIDE, VAR_DECLARE, VAR_ASSIGN + 조건/값 슬롯

## 폴더 구조
- `src/App.jsx` — 에디터/팔레트/출력 메인 로직, 드래그·스냅·동기화 처리
- `src/components/`
  - `editor/` — 블록 렌더링·팔레트 UI
  - `run/` — 실행 버튼, 콘솔 출력, WebSocket 구독
  - `layout/` — 기본 레이아웃
- `src/utils/`
  - `blockCompiler.js` — UI 블록 → 백엔드 DTO 변환 (order/조건/분기/표현식)
  - `blockSyncer.js` — POST/PUT/DELETE 동기화, 중복 PUT 억제
- `src/config.js` — API_ROOT/PROJECT_ID 설정
- `src/polyfills.js` — 브라우저용 global 폴리필(SockJS)

## 실행
```bash
# 의존성 설치
npm install

# 개발 서버 (기본: http://localhost:8080 API)
npm run dev

# 프로덕션 빌드/미리보기
npm run build
npm run preview
```
환경 변수: `.env` 에 `VITE_API_ROOT`(기본 http://localhost:8080), `VITE_PROJECT_ID`(기본 1) 설정. 다른 API로 테스트 시 실행 전에 `VITE_API_ROOT=... npm run dev`.

## 백엔드 엔드포인트 매핑
- 블록 목록: `GET /api/blocks/project/{projectId}`
- 블록 생성: `POST /api/blocks/project/{projectId}`
- 블록 수정: `PUT /api/blocks/{id}`
- 블록 삭제: `DELETE /api/blocks/{id}`
- 실행: `POST /api/execution/projects/{projectId}/run` → 응답의 `sessionId`로 `/ws` 연결 후 `/topic/execution/{sessionId}` 구독

## 지원 블록 타입 및 필드
- 공통: `positionX`, `positionY`, `order`, `nextBlockId`
- 제어: IF(`conditionExpression`, `trueBranchId`, `falseBranchId`), FOR(`conditionExpression`, `initExpression`, `incrementExpression`, `trueBranchId`), WHILE(`conditionExpression`, `trueBranchId`)
- 출력: PRINT(`message`), ALERT(`message`), DRAW(`shape`, `color`, `size`, optional `message`)
- 산술: ADD/SUBTRACT/MULTIPLY/DIVIDE(`operand1`, `operand2`, `resultVariable`)
- 변수: VAR_DECLARE(`variableName`, `variableType`, `initialValue`), VAR_ASSIGN(`variableName`, `valueExpression`)
- 시작: START

## 동기화 흐름 (App.jsx + blockSyncer.js)
1) UI 변경(setBlocks) 시 `syncProjectBlocks` 실행  
2) 신규 노드는 `POST /api/blocks/project/{projectId}`로 생성  
3) 모든 노드에 대해 `PUT /api/blocks/{id}`로 위치/연결/필드 갱신  
   - 기존 상태와 동일한 payload는 전송 생략  
   - 매핑되지 않은 next/분기 id는 null 처리(잘못된 큰 숫자 방지)  
4) 삭제된 로컬 노드는 `DELETE /api/blocks/{id}`  

## 실행 흐름 (RunPane.jsx)
1) 현재 블록 상태를 컴파일 → 서버 블록 초기화(기존 삭제) → POST 생성 → PUT 연결  
2) `POST /api/execution/projects/{projectId}/run` 호출  
3) 응답 `sessionId`로 SockJS(`${API_ROOT}/ws`) + STOMP 연결, `/topic/execution/{sessionId}` 구독  
4) 수신 메시지를 콘솔 영역에 표시, COMPLETE/ERROR 시 연결 종료  

## 불러오기/표현식 복원
- 서버 블록 조회 시 팔레트 색/형식으로 복원  
- 조건식(`x > 5`, `5 < 10`)은 비교 연산자 블록 + 좌/우 값 블록으로 분해해 조건 슬롯에 꽂음  
- PRINT/ALERT 메시지는 문자열 값 블록으로, VAR_ASSIGN 값은 값 블록으로 생성  
- 값 블록 색상: boolean=하늘, 문자열=핑크, 숫자/일반 값=파랑  

## WebSocket 설정 (백엔드)
백엔드가 제공하는 `/ws` 엔드포인트와 `/topic` 브로커에 맞춰 STOMP/SockJS로 연결합니다. 실행 세션 id는 `/topic/execution/{sessionId}` 로 구독.

## 팁
- 다른 API로 테스트 시: `VITE_API_ROOT=https://api.blockcoding.kro.kr npm run dev`
- 프록시나 동일 오리진이 아니면 OPTIONS 프리플라이트가 발생하는 것이 정상입니다.
- 블록이 안 붙거나 색이 맞지 않는 경우: 서버 응답의 blockType/필드를 확인하고, 팔레트 색상 규칙에 맞게 매핑되어 있는지 점검하세요.
- 타입 추론 예시  
  - `command-if`, `command-if-else` → `IF`  
  - `command-while` → `WHILE`  
  - `command-repeat` → `FOR`  
  - `command-print` → `PRINT`  
  - `variable-set` → `VAR_ASSIGN`  
  - 기타는 텍스트/카테고리 기준으로 `START`, `VAR_DECLARE`, `PRINT`를 추론
- 필드 매핑  
- 위치/순서: `positionX`, `positionY`, `order`  
- 연결: `nextBlockId`, `trueBranchId`, `falseBranchId` (슬롯/parentSlot 기준 추론)  
- 조건식: `conditionExpression` (조건 슬롯 텍스트 fallback)  
- 변수: `variableName`, `initialValue`, `valueExpression`  
- 반복문: `initExpression`, `incrementExpression`  
- 출력: `message`
- 산술: `operand1`, `operand2`, `resultVariable`

### 4) 네트워크 요청 확인 팁
- 브라우저 DevTools 네트워크 탭에서 `api/blocks` 요청을 보면 `Request Payload`에 위 필드들이 포함되어야 합니다.
- OPTIONS만 보이고 Body가 비면, 실제 POST/PUT을 찾아보거나 CORS 설정이 막히지 않았는지(백엔드 `WebMvc`/CORS) 확인하세요.

### 5) 문제 해결 체크리스트
- 백엔드가 실행 중인지, 포트가 맞는지 확인합니다.
- `.env`의 `VITE_API_ROOT`, `VITE_PROJECT_ID`가 실제 서버와 일치하는지 확인합니다.
- 네트워크 탭에 DELETE/POST/PUT 순서가 보이지 않으면, 브라우저 캐시를 지우고 새로고침 후 다시 블록을 드롭해 봅니다.
