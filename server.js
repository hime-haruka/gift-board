const express = require('express');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'dev-token';

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const defaultSettings = {
  maxItems: 10,
  minValue: 0,
  showProfiles: true,
  showGiftImage: true,
  showDiamondValue: true,
  fontSize: 20,
  cardOpacity: 96,
  mergeWindowMs: 15000,
  keepRule: 'highestValue',
};

const state = {
  items: [],
  settings: { ...defaultSettings },
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pick(...values) {
  return values.find(v => v !== undefined && v !== null && v !== '');
}

function normalizeEvent(raw = {}) {
  const type = raw.type || raw.eventType || raw.event || (raw.gift || raw.giftName ? 'gift' : 'gift');
  const user = raw.user || raw.sender || raw.data?.user || raw.data?.sender || {};
  const gift = raw.gift || raw.data?.gift || {};

  if (String(type).includes('member') || String(type).includes('level')) {
    const level = pick(raw.level, raw.newLevel, raw.memberLevel, raw.data?.level, raw.data?.newLevel, user.memberLevel, 1);
    return {
      id: uid(),
      type: 'member_level',
      nickname: pick(raw.nickname, user.nickname, user.uniqueId, user.displayName, raw.uniqueId, 'guest'),
      profileImage: pick(raw.profileImage, user.profilePictureUrl, user.avatar, user.profileImageUrl, user.image, ''),
      level: normalizeNumber(level, 1),
      value: 0,
      createdAt: Date.now(),
      raw,
    };
  }

  const repeatCount = normalizeNumber(pick(raw.count, raw.repeatCount, raw.quantity, raw.amount, raw.data?.count, gift.repeatCount), 1);
  const diamond = normalizeNumber(pick(raw.diamondCount, raw.diamond, raw.value, raw.coin, raw.data?.diamondCount, gift.diamondCount, gift.diamond), 0);
  const value = normalizeNumber(pick(raw.totalValue, raw.totalDiamond, raw.totalDiamonds), diamond * repeatCount);

  return {
    id: uid(),
    type: 'gift',
    nickname: pick(raw.nickname, user.nickname, user.uniqueId, user.displayName, raw.uniqueId, 'guest'),
    profileImage: pick(raw.profileImage, user.profilePictureUrl, user.avatar, user.profileImageUrl, user.image, ''),
    giftName: pick(raw.giftName, gift.name, gift.giftName, raw.name, 'Gift'),
    giftImage: pick(raw.giftImage, raw.giftPictureUrl, raw.image, raw.icon, gift.image, gift.icon, gift.giftPictureUrl, gift.pictureUrl, ''),
    count: repeatCount,
    diamond,
    value,
    createdAt: Date.now(),
    raw,
  };
}

function shouldMerge(a, b) {
  if (!a || !b) return false;
  if (a.type !== 'gift' || b.type !== 'gift') return false;
  if (a.nickname !== b.nickname) return false;
  if (a.giftName !== b.giftName) return false;
  return Math.abs(a.createdAt - b.createdAt) <= normalizeNumber(state.settings.mergeWindowMs, 15000);
}

function applyKeepRule() {
  const maxItems = Math.max(1, normalizeNumber(state.settings.maxItems, 10));
  const minValue = Math.max(0, normalizeNumber(state.settings.minValue, 0));

  let filtered = state.items.filter(item => item.type !== 'gift' || normalizeNumber(item.value, 0) >= minValue);
  if (filtered.length > maxItems) {
    filtered = [...filtered]
      .sort((a, b) => normalizeNumber(b.value, 0) - normalizeNumber(a.value, 0) || b.createdAt - a.createdAt)
      .slice(0, maxItems);
  }
  state.items = filtered.sort((a, b) => b.createdAt - a.createdAt);
}

function broadcast(payload) {
  const msg = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

function addEvent(raw) {
  const event = normalizeEvent(raw);
  const existing = state.items.find(item => shouldMerge(item, event));
  if (existing) {
    existing.count += event.count || 1;
    existing.value += event.value || 0;
    existing.createdAt = Date.now();
    existing.giftImage = existing.giftImage || event.giftImage;
    existing.profileImage = existing.profileImage || event.profileImage;
  } else {
    state.items.unshift(event);
  }
  applyKeepRule();
  broadcast({ type: 'state', ...publicState() });
  return event;
}

function publicState() {
  return { items: state.items, settings: state.settings };
}

function checkToken(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token || req.body?.token;
  if (ADMIN_TOKEN && token !== ADMIN_TOKEN) {
    return res.status(403).json({ ok: false, error: 'Invalid admin token' });
  }
  next();
}

app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/overlay', express.static(path.join(__dirname, 'overlay')));
app.use('/local-receiver', express.static(path.join(__dirname, 'local-receiver')));

app.get('/', (req, res) => {
  res.type('text').send('Server is alive');
});

app.get('/api/state', (req, res) => {
  res.json(publicState());
});

app.post('/api/event', (req, res) => {
  const event = addEvent(req.body);
  res.json({ ok: true, event, state: publicState() });
});

app.post('/api/settings', checkToken, (req, res) => {
  const incoming = req.body || {};
  state.settings = {
    ...state.settings,
    ...incoming,
    maxItems: normalizeNumber(incoming.maxItems, state.settings.maxItems),
    minValue: normalizeNumber(incoming.minValue, state.settings.minValue),
    fontSize: normalizeNumber(incoming.fontSize, state.settings.fontSize),
    cardOpacity: normalizeNumber(incoming.cardOpacity, state.settings.cardOpacity),
    mergeWindowMs: normalizeNumber(incoming.mergeWindowMs, state.settings.mergeWindowMs),
    showProfiles: Boolean(incoming.showProfiles),
    showGiftImage: Boolean(incoming.showGiftImage),
    showDiamondValue: Boolean(incoming.showDiamondValue),
  };
  applyKeepRule();
  broadcast({ type: 'state', ...publicState() });
  res.json({ ok: true, settings: state.settings });
});

app.post('/api/clear', checkToken, (req, res) => {
  state.items = [];
  broadcast({ type: 'state', ...publicState() });
  res.json({ ok: true });
});

app.post('/api/test/gift', checkToken, (req, res) => {
  const sample = {
    type: 'gift',
    nickname: req.body.nickname || '민수',
    profileImage: req.body.profileImage || '',
    giftName: req.body.giftName || 'Donut',
    giftImage: req.body.giftImage || 'https://placehold.co/80x80/fff5ce/9c6a00.png?text=%F0%9F%8E%81',
    count: normalizeNumber(req.body.count, 5),
    diamond: normalizeNumber(req.body.diamond, 1000),
  };
  sample.value = sample.diamond * sample.count;
  const event = addEvent(sample);
  res.json({ ok: true, event, state: publicState() });
});

app.post('/api/test/member', checkToken, (req, res) => {
  const event = normalizeEvent({
    type: 'member_level',
    nickname: req.body.nickname || 'sora',
    profileImage: req.body.profileImage || '',
    level: normalizeNumber(req.body.level, 8),
  });
  state.items.unshift(event);
  applyKeepRule();
  broadcast({ type: 'state', ...publicState() });
  res.json({ ok: true, event, state: publicState() });
});

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'state', ...publicState() }));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
