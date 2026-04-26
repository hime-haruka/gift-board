Gift Board API Fix Patch

덮어쓸 파일:
1. 최상위 server.js
2. 최상위 package.json
3. local-receiver/receiver.js
4. local-receiver/package.json

config.json은 네가 이미 수정해둔 걸 유지해도 됩니다.
serverUrl은 둘 중 하나 모두 동작합니다:
- https://gift-board.onrender.com
- https://gift-board.onrender.com/api/event

Render:
Build Command: npm install
Start Command: npm start

로컬:
cd local-receiver
npm install
npm start

정상:
Connected to TikFinity WebSocket.
Waiting for gift/member level events...

기프트 수신 시:
NORMALIZED EVENT: ...
Forwarded: gift ...
