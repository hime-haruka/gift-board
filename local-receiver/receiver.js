const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const configPath = path.join(__dirname, 'config.json');
const examplePath = path.join(__dirname, 'config.example.json');

if (!fs.existsSync(configPath)) {
  fs.copyFileSync(examplePath, configPath);
  console.log('config.json created. Edit serverUrl first, then run again.');
  process.exit(0);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const tikfinityWsUrl = config.tikfinityWsUrl || 'ws://localhost:21213/';
const serverUrl = (config.serverUrl || '').replace(/\/$/, '');

if (!serverUrl || serverUrl.includes('YOUR-APP')) {
  console.error('Please edit local-receiver/config.json serverUrl.');
  process.exit(1);
}

function pick(...values) { return values.find(v => v !== undefined && v !== null && v !== ''); }

function normalizeTikfinityMessage(message) {
  const eventName = String(pick(message.event, message.type, message.eventName, message.action, '')).toLowerCase();
  const data = message.data || message || {};
  const user = data.user || data.sender || data.viewer || {};
  const gift = data.gift || {};

  if (eventName.includes('member') || eventName.includes('level')) {
    return {
      type: 'member_level',
      nickname: pick(data.nickname, user.nickname, user.uniqueId, user.displayName, data.uniqueId),
      profileImage: pick(data.profileImage, user.profilePictureUrl, user.avatar, user.profileImageUrl),
      level: pick(data.level, data.newLevel, data.memberLevel, user.memberLevel),
      raw: message,
    };
  }

  if (eventName.includes('gift') || data.giftName || gift.name) {
    return {
      type: 'gift',
      nickname: pick(data.nickname, user.nickname, user.uniqueId, user.displayName, data.uniqueId),
      profileImage: pick(data.profileImage, user.profilePictureUrl, user.avatar, user.profileImageUrl),
      giftName: pick(data.giftName, gift.name, gift.giftName, data.name),
      giftImage: pick(data.giftImage, data.giftPictureUrl, data.image, data.icon, gift.image, gift.icon, gift.giftPictureUrl, gift.pictureUrl),
      count: pick(data.count, data.repeatCount, data.quantity, data.amount, gift.repeatCount, 1),
      diamond: pick(data.diamondCount, data.diamond, data.value, data.coin, gift.diamondCount, gift.diamond, 0),
      raw: message,
    };
  }

  return null;
}

async function sendEvent(event) {
  const res = await fetch(`${serverUrl}/api/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
}

function connect() {
  console.log(`Connecting to TikFinity: ${tikfinityWsUrl}`);
  const ws = new WebSocket(tikfinityWsUrl);

  ws.on('open', () => console.log('Connected to TikFinity WebSocket.'));
  ws.on('message', async (buffer) => {
    try {
      const message = JSON.parse(buffer.toString());
      const event = normalizeTikfinityMessage(message);
      if (!event) return;
      await sendEvent(event);
      console.log('Forwarded:', event.type, event.nickname || '', event.giftName || '', event.level || '');
    } catch (err) {
      console.error('Event handling failed:', err.message);
    }
  });
  ws.on('close', () => {
    console.log('TikFinity WebSocket closed. Reconnecting in 3 seconds...');
    setTimeout(connect, 3000);
  });
  ws.on('error', (err) => console.error('TikFinity WebSocket error:', err.message));
}

connect();
