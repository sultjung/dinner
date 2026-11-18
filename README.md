# SATURDAY GOLF DAY · 2026.11.21

Premium Golf Club 스타일의 React + TypeScript + Vite 대시보드입니다. 로그인/DB 없이 GitHub Pages에서 실행할 수 있습니다.

## 구현 설계

```
Settings (React state)
 ├─ restaurant + travel mode ─▶ Kakao SDK places keyword search ─▶ matched coordinates
 │                                                       │
 │                                                       ▼
 │                                  Cloudflare Worker /route ─▶ Kakao routing REST
 │                                                       │
 │                                                       ▼
 ├─ durations / waiting times ──────────────────────▶ schedule() ─▶ timeline / ETAs
 ├─ restaurant-specific budgets ────────────────────▶ totals()   ─▶ KPI / cost split
 └─ localStorage and URL ?plan= ────────────────────▶ reload / share
```

**핵심 원칙:** 키 또는 경로 응답이 없을 때 임의 보행거리·시간·좌표·폴리라인을 생성하지 않습니다. 그 경우 첫 일정 시간만 확정하고 이후 예상 도착시간과 총거리/시간을 `미확인`으로 나타냅니다. 예산은 실가격이 아닌 예시값입니다.

## 폴더 구조

```
saturday-golf-day/
├── index.html, package.json, vite.config.ts, tailwind.config.js
├── src/
│   ├── main.tsx          # React entry
│   ├── App.tsx           # UI, 상태, 공유, 예산
│   ├── MapView.tsx       # 카카오맵 overlay, 폴리라인
│   ├── config.ts         # 장소/시간/가격 설정
│   ├── logic.ts          # 도착시간/총예산/공유 검증
│   ├── logic.test.ts     # 시뮬레이션 테스트
│   ├── map.ts            # SDK 로딩, 장소 매칭, 라우트 요청
│   └── style.css         # Tailwind + 디자인
├── worker/
│   ├── index.js          # 도보/자동차 경로 프록시
│   └── wrangler.toml
├── .github/workflows/deploy.yml
└── .env.example
```

## 설치 및 실행

Node.js 20.19+ 또는 22+ 권장.

```bash
npm install
cp .env.example .env.local   # Windows: copy .env.example .env.local
npm run dev
npm run test
npm run build
npm run preview
```

브라우저에서 `http://localhost:5173` 접속. API 키 없이도 **식당 선택, 비용·시간 수정, 공유 URL, 상태 저장, PNG 출력, 인쇄**가 동작하도록 설계되어 있습니다. 지도는 키 없이 실제 지도를 표시할 수 없으며 라이브 데이터만 표시합니다.

## Kakao API 키 설정

1. [Kakao Developers](https://developers.kakao.com/) 앱 생성 → Kakao Map API 사용 설정 확인.
2. JavaScript 키를 `.env.local`의 `VITE_KAKAO_JS_KEY=`에 등록합니다. **JS 키는 브라우저에서 공개되는 식별자**이므로 허용 도메인 제한을 적용하십시오. `http://localhost:5173`과 배포 도메인을 사이트 도메인에 등록합니다.
3. 경로용 **REST API 키는 절대 `VITE_` 변수에 넣지 않습니다.** Cloudflare Worker Secret으로 등록합니다.
4. 카카오 서비스의 해당 지도/길찾기 API 이용권한·쿼터가 활성화되어야 합니다. 기능이나 과금정책은 카카오 콘솔에서 별도 확인하십시오.

### 서버리스 경로 프록시 (Cloudflare Workers)

```bash
cd worker
npx wrangler login
npx wrangler secret put KAKAO_REST_KEY
npx wrangler deploy
```

`worker/wrangler.toml`의 `ALLOWED_ORIGINS`를 배포 URL 및 로컬 주소로 바꿉니다. Worker 주소를 프론트의 `.env.local`에 다음처럼 등록합니다.

```
VITE_ROUTE_PROXY_URL=https://saturday-golf-route.YOUR_SUBDOMAIN.workers.dev
```

**동작**: 도보 모드는 `GET https://dapi.kakao.com/v2/routing/walk`, 자동차 모드는 `GET https://apis-navi.kakaomobility.com/v1/directions`를 호출합니다. 응답 거리(m), 시간(s), 실제 지오메트리 경로만 정규화하여 반환합니다. 길찾기 권한 제한, 미검색, 오류 시 미확인 상태로 전환됩니다. Worker는 CORS 허용 Origin 목록 및 한국 좌표 범위 검증을 수행합니다. 공유 공개형 서비스라면 추가적인 호출량 제한도 권장합니다.

## GitHub Pages 배포

1. 새 GitHub 리포지토리에 전체 파일을 푸시합니다. 기본 브랜치는 `main`.
2. Repository → Settings → Pages → Source를 **GitHub Actions**로 설정합니다.
3. Repository → Settings → Secrets and variables → Actions → **Variables**에 아래 값을 추가합니다.
   - `KAKAO_JS_KEY`: 카카오 JavaScript 키
   - `ROUTE_PROXY_URL`: Worker URL
4. `.github/workflows/deploy.yml`에서 자동 테스트 및 빌드 후 Pages를 배포합니다. `BASE_PATH`는 `/<repo-name>/`으로 자동 설정되어 프로젝트형 Pages의 새로고침도 작동합니다. 클라이언트 라우터가 없어 별도 404 fallback은 필요하지 않습니다.
5. 첫 배포 뒤에는 카카오 콘솔의 도메인 허용 목록에 실제 Pages 주소를 추가합니다.

## 장소 데이터 수정

`src/config.ts`의 `places`를 수정합니다. **다른 골프존파크 지점이 자동 매칭되지 않도록** 이름과 정확한 주소(`addressHint`)를 모두 확인합니다. 런타임에 카카오 지도 검색 결과가 **정확히 한 개** 매칭될 때만 좌표를 채택합니다. 일치 후보가 없거나 복수면 `확인 필요`로 유지하며, 장소 링크를 열어 직접 검증해야 합니다. 푸르지오시티 마커는 101동의 개별 출입구가 아닌 카카오의 단지 좌표를 사용합니다.

- 스크린 골프: 왕산로 122 지하2층 3호 (온라인 매장 정보 기반, 현장 재확인 권장)
- 당구: 왕산로26길 13 2층 (사용자 제공, 지도 일치 확인 전)
- 전시회 제기본점: 왕산로 131
- 신숯불탁탁: 고산자로24길 12-1
- 동대문 푸르지오시티 101동: 왕산로 86 (지도는 카카오에 등록된 단지 위치 표시)

왼쪽 일정에서 점심 식당을 고르고 장소별 재생 여부를 선택할 수 있습니다. **시뮬레이션**을 누르면 확인된 지도 위치를 일정 순서대로 보여줍니다. 각 장소의 재생 길이는 화면 연출용입니다.

## 비용 / 일정 수정

`src/config.ts`의 `defaults`와 `initialBudget` 수정. 비용은 모두 **4인 전체 합계** 기준입니다. 고깃집은 `meat`(고기 구매비) + `table`(상차림) + `extra`(추가 메뉴)를 각각 관리합니다. 런타임에서 한 식당의 입력값은 다른 식당으로 전환해도 유지됩니다.

### 시간 계산

`arrival[i+1] = arrival[i] + wait[i] + duration[i] + ceil(routeTime[i] / 60)`

즉 대기시간은 각 장소의 **활동 시작 전**에 적용합니다. 일정 시작시각은 `08:00`, 화면의 `12:30`은 API 확인 전까지 **고정된 예약시간이 아닌 목표값**입니다. 실제 영업시간과의 충돌은 **검증된 시간 데이터가 없는 장소는 자동 판정하지 않습니다**. 운영시간은 카드에 참고 정보로 보여주지만, 자동으로 확정하거나 허위 경고하지 않습니다.

## 현재 범위와 한계

- **실제 카카오 지도/실제 도보·자동차 경로**: 각종 키 및 API 권한 등록 후 동작. API 키 없는 현재 전달물은 실제 거리/시간을 계산하지 않음.
- **정확한 장소좌표**: 카카오맵 검색 결과와 이름/주소가 유일하게 일치할 때만 사용.
- **실제 식당 사진**: 저작권·재사용 허가가 명확하지 않아 임의 외부 이미지를 넣지 않았으며 디자인용 그래픽 플레이스홀더를 사용함. 사용 허가받은 이미지로 대체 가능.
- **영업시간 자동 충돌 판단**: 신뢰할 수 있는 영업시간 API 및 휴무 데이터가 연결되지 않아 미구현. 카드의 표시 시간은 사전 참고용이며 재확인 필요.
- **종료시간**: `final` 체류시간을 조정하여 변경.
- **공유 URL**: 설정이 포함되므로 링크가 길어질 수 있음.
- **PNG 저장**: 최종 일정 스냅샷 영역을 PNG로 생성. 브라우저 캡처 보안 정책 등 환경에 따라 실패할 수 있음.

## 테스트 수행 상태

- Node/TypeScript 로직 직접 컴파일: 성공.
- 아래 테스트 케이스의 기대값과 `schedule()`/`totals()` 로직 실행: 확인.
  - 08:00 시작 → 11:00 골프 종료 (이동 경로 없는 경우 다음 도착 미확인)
  - 샘플 경로 10, 15, 20분 → 11:10 당구, 12:25 점심, 14:45 마지막 장소
  - 당구 60→90분 변경 → 점심 시작 12:25→12:55
  - 예시 기본 전체예산: 전시회 354,000원 / 신숯불탁탁 446,000원
- `npm run test` 및 `npm run build`: 작업 환경의 npm registry 다운로드 제한으로 실제 실행 불가. 배포용 workflow에서 실행 설정됨.
- Kakao API 라이브 통합 테스트: 사용자 API 키가 없어 미실행.

### 소스 확인 참조

- [Kakao Map REST docs](https://developers.kakao.com/docs/en/kakaomap/rest-api)
- [Kakao Mobility Directions](https://developers.kakaomobility.com/guide/navi-api/directions.html)
- [Kakao Developers Quotas](https://developers.kakao.com/docs/en/getting-started/quota)
