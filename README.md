# TikFinity Gift Board - Render Ready

OBS 브라우저 소스용 기프트/멤버 레벨업 보드입니다.

## GitHub에 올릴 것

이 폴더 안의 파일/폴더를 그대로 업로드하세요.

- `admin/`
- `overlay/`
- `local-receiver/`
- `server.js`
- `package.json`
- `render.yaml`
- `.gitignore`
- `README.md`

`node_modules/`는 올리지 않습니다.

## Render 설정

Render → New + → Web Service → GitHub 레포 선택

- Root Directory: 비워두기
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`

Environment Variables:

- `NODE_ENV` = `production`
- `ADMIN_TOKEN` = 원하는 관리자 토큰. 테스트 중이면 `dev-token`

배포 후 `/`에 접속해서 `Server is alive`가 뜨면 서버는 정상입니다.

## 접속 URL

Render 주소가 `https://gift-board.onrender.com` 라면:

- 관리자: `https://gift-board.onrender.com/admin`
- 오버레이: `https://gift-board.onrender.com/overlay`

## OBS 설정

OBS → 브라우저 소스 추가

- URL: `https://gift-board.onrender.com/overlay`
- Width: 1080
- Height: 1920
- 배경은 투명 처리되어 있습니다.

카드 너비는 오버레이 브라우저 소스의 가로폭에 맞춰집니다. OBS에서 소스 폭을 줄이면 카드도 같이 줄어듭니다.

## 관리자 페이지

관리자 페이지에서 토큰을 입력해야 설정 저장/테스트 버튼이 작동합니다.

기본 토큰은 `dev-token`입니다. Render에서 `ADMIN_TOKEN`을 바꿨다면 관리자 페이지의 토큰도 같은 값으로 입력하세요.

가능한 설정:

- 최대 표시 개수
- 최소 표시 금액
- 폰트 크기
- 카드 불투명도
- 프로필 표시
- 기프트 이미지 표시
- 다이아/환산값 표시
- 테스트 기프트
- 멤버 레벨업 테스트
- 리스트 초기화

## TikFinity 실제 연동

`local-receiver` 폴더는 방송 PC에서 실행합니다.

1. `local-receiver` 폴더로 이동
2. `npm install`
3. `npm start`
4. 첫 실행 시 `config.json`이 생성됩니다.
5. `config.json`의 `serverUrl`을 Render 주소로 바꿉니다.
6. 다시 `npm start`

예시:

```json
{
  "tikfinityWsUrl": "ws://localhost:21213/",
  "serverUrl": "https://gift-board.onrender.com",
  "adminToken": "dev-token"
}
```

TikFinity Desktop App의 WebSocket 주소가 다르면 `tikfinityWsUrl`을 실제 주소로 변경하세요.

## 기프트 이미지에 대해

TikFinity 이벤트 안에 기프트 이미지 URL이 들어오면 오버레이에서 표시됩니다.

현재 대응 필드:

- `giftImage`
- `giftPictureUrl`
- `image`
- `icon`
- `gift.image`
- `gift.icon`
- `gift.giftPictureUrl`
- `gift.pictureUrl`

실제 라이브 테스트에서 필드명이 다르면 `server.js` 또는 `local-receiver/receiver.js`의 매핑에 1줄만 추가하면 됩니다.

## 문제 해결

### /admin 또는 /overlay가 Not Found

`server.js`, `admin/index.html`, `overlay/index.html`이 GitHub에 올라갔는지 확인하세요.
Render Root Directory는 비워두어야 합니다.

### Application exited early

`server.js`가 포트를 열지 못한 상태입니다. 이 프로젝트의 `server.js`를 그대로 사용하세요.

### 관리자 테스트는 되는데 실제 기프트가 안 뜸

local-receiver 콘솔 로그를 확인하세요.
TikFinity WebSocket 주소가 맞는지, 실제 이벤트가 들어오는지 봐야 합니다.
