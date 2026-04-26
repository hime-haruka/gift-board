import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'dev-token';

const defaultSettings = {
  maxItems: 10,
  minValue: 0,
  fontSize: 14,
  showProfile: true,
  showGiftIcon: true,
  showRank: false,
  showValue: true,
  backgroundOpacity: 0.76,
  cardGap: 6,
  cardHeight: 46,
  viewSort: 'latest',
  keepRule: 'highestValue',
  mergeEnabled: true,
  mergeWindowMs: 15000,
  allowedGifts: '',
  hiddenUsers: '',
  boardTitle: '',
  accentText: ''
};

const state = loadState();

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadState() {
  ensureDataDir();
  if (!fs.existsSync(STATE_FILE)) {
    return { settings: defaultSettings, gifts: [] };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return {
      settings: { ...defaultSettings, ...(parsed.settings || {}) },
      gifts: Array.isArray(parsed.gifts) ? parsed.gifts : []
    };
  } catch {
    return { settings: defaultSettings, gifts: [] };
  }
}

function saveState() {
  ensureDataDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function isAdmin(req) {
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const token = req.query.token || req.body?.token || bearer;
  return String(token) === String(ADMIN_TOKEN);
}

function parseList(value) {
  return String(value || '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

function sanitizeSettings(input) {
  const next = { ...state.settings, ...input };
  next.maxItems = clampInt(next.maxItems, 1, 50, defaultSettings.maxItems);
  next.minValue = clampInt(next.minValue, 0, 999999999, defaultSettings.minValue);
  next.fontSize = clampInt(next.fontSize, 10, 48, defaultSettings.fontSize);
  next.cardGap = clampInt(next.cardGap, 0, 30, defaultSettings.cardGap);
  next.cardHeight = clampInt(next.cardHeight, 42, 140, defaultSettings.cardHeight);
  next.backgroundOpacity = clampFloat(next.backgroundOpacity, 0, 1, defaultSettings.backgroundOpacity);
  next.mergeWindowMs = clampInt(next.mergeWindowMs, 1000, 120000, defaultSettings.mergeWindowMs);
  next.showProfile = Boolean(next.showProfile);
  next.showGiftIcon = Boolean(next.showGiftIcon);
  next.showRank = Boolean(next.showRank);
  next.showValue = Boolean(next.showValue);
  next.mergeEnabled = Boolean(next.mergeEnabled);
  if (!['latest', 'highestValue'].includes(next.viewSort)) next.viewSort = defaultSettings.viewSort;
  if (!['highestValue', 'latest'].includes(next.keepRule)) next.keepRule = defaultSettings.keepRule;
  next.boardTitle = String(next.boardTitle || defaultSettings.boardTitle).slice(0, 40);
  next.accentText = String(next.accentText || defaultSettings.accentText).slice(0, 40);
  next.allowedGifts = String(next.allowedGifts || '').slice(0, 500);
  next.hiddenUsers = String(next.hiddenUsers || '').slice(0, 500);
  return next;
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function clampFloat(value, min, max, fallback) {
  const n = Number.parseFloat(value);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}


function normalizeMember(input) {
  const now = Date.now();
  const level = Number(input.level ?? input.memberLevel ?? input.newLevel ?? 0) || 0;
  return {
    id: input.id || `member-${now}-${Math.random().toString(36).slice(2, 9)}`,
    type: 'member',
    userId: String(input.userId || input.uniqueId || input.nickname || input.user || 'unknown'),
    nickname: String(input.nickname || input.displayName || input.uniqueId || input.user || 'Unknown'),
    profileUrl: String(input.profileUrl || input.avatar || input.profilePictureUrl || ''),
    level,
    title: String(input.title || input.memberTitle || (level ? `Member Lv.${level}` : 'Member Level Up')),
    totalValue: Number(input.totalValue || 0) || 0,
    createdAt: Number(input.createdAt || now),
    updatedAt: Number(input.updatedAt || now)
  };
}

function normalizeGift(input) {
  const now = Date.now();
  const count = Number(input.count ?? input.repeatCount ?? input.amount ?? 1) || 1;
  const unitValue = Number(input.unitValue ?? input.diamondCount ?? input.value ?? input.giftValue ?? 0) || 0;
  const totalValue = Number(input.totalValue ?? input.valueTotal ?? unitValue * count) || 0;
  return {
    id: input.id || `${now}-${Math.random().toString(36).slice(2, 9)}`,
    type: 'gift',
    userId: String(input.userId || input.uniqueId || input.nickname || input.user || 'unknown'),
    nickname: String(input.nickname || input.displayName || input.uniqueId || input.user || 'Unknown'),
    profileUrl: String(input.profileUrl || input.avatar || input.profilePictureUrl || ''),
    giftId: String(input.giftId || input.giftName || input.name || 'gift'),
    giftName: String(input.giftName || input.name || 'Gift'),
    giftIconUrl: String(input.giftIconUrl || input.giftPictureUrl || input.giftImageUrl || input.imageUrl || input.iconUrl || input.icon || ''),
    count,
    unitValue,
    totalValue,
    createdAt: Number(input.createdAt || now),
    updatedAt: Number(input.updatedAt || now)
  };
}

function shouldAcceptGift(gift) {
  const settings = state.settings;
  if (gift.totalValue < settings.minValue) return false;

  const hiddenUsers = parseList(settings.hiddenUsers);
  const allowedGifts = parseList(settings.allowedGifts);

  const userKeys = [gift.userId, gift.nickname].map((v) => String(v).toLowerCase());
  if (hiddenUsers.length && userKeys.some((v) => hiddenUsers.includes(v))) return false;

  const giftKeys = [gift.giftId, gift.giftName].map((v) => String(v).toLowerCase());
  if (allowedGifts.length && !giftKeys.some((v) => allowedGifts.includes(v))) return false;

  return true;
}


function addMember(rawMember) {
  const member = normalizeMember(rawMember);
  state.gifts.unshift(member);
  pruneGifts();
  saveState();
  broadcastState();
  return { accepted: true, member };
}

function addGift(rawGift) {
  const gift = normalizeGift(rawGift);
  if (!shouldAcceptGift(gift)) return { accepted: false, gift };

  const settings = state.settings;
  if (settings.mergeEnabled) {
    const lastMatch = state.gifts.find((item) => {
      const sameUser = item.userId === gift.userId || item.nickname === gift.nickname;
      const sameGift = item.giftId === gift.giftId || item.giftName === gift.giftName;
      const closeEnough = gift.createdAt - item.updatedAt <= settings.mergeWindowMs;
      return sameUser && sameGift && closeEnough;
    });

    if (lastMatch) {
      lastMatch.count += gift.count;
      lastMatch.totalValue += gift.totalValue;
      lastMatch.unitValue = gift.unitValue || lastMatch.unitValue;
      lastMatch.updatedAt = gift.createdAt;
      lastMatch.profileUrl = gift.profileUrl || lastMatch.profileUrl;
      lastMatch.giftIconUrl = gift.giftIconUrl || lastMatch.giftIconUrl;
      pruneGifts();
      saveState();
      broadcastState();
      return { accepted: true, gift: lastMatch, merged: true };
    }
  }

  state.gifts.unshift(gift);
  pruneGifts();
  saveState();
  broadcastState();
  return { accepted: true, gift, merged: false };
}

function pruneGifts() {
  const max = state.settings.maxItems;
  if (state.gifts.length <= max) return;

  let kept;
  if (state.settings.keepRule === 'latest') {
    kept = [...state.gifts].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, max);
  } else {
    kept = [...state.gifts]
      .sort((a, b) => b.totalValue - a.totalValue || b.updatedAt - a.updatedAt)
      .slice(0, max);
  }

  const keptIds = new Set(kept.map((item) => item.id));
  state.gifts = state.gifts.filter((item) => keptIds.has(item.id));
}

function getPublicState() {
  const gifts = [...state.gifts];
  if (state.settings.viewSort === 'highestValue') {
    gifts.sort((a, b) => b.totalValue - a.totalValue || b.updatedAt - a.updatedAt);
  } else {
    gifts.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  return { settings: state.settings, gifts };
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/overlay', express.static(path.join(ROOT, 'public/overlay')));
app.use('/admin', express.static(path.join(ROOT, 'public/admin')));

app.get('/', (_req, res) => res.redirect('/admin'));
app.get('/api/state', (_req, res) => res.json(getPublicState()));

app.post('/api/settings', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  state.settings = sanitizeSettings(req.body || {});
  pruneGifts();
  saveState();
  broadcastState();
  res.json({ ok: true, state: getPublicState() });
});

app.post('/api/gift', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  const result = addGift(req.body || {});
  res.json({ ok: true, ...result });
});

app.post('/api/clear', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  state.gifts = [];
  saveState();
  broadcastState();
  res.json({ ok: true });
});


app.post('/api/member', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  const result = addMember(req.body || {});
  res.json({ ok: true, ...result });
});

app.post('/api/test-member', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  const samples = [
    { nickname: '루리단장', level: 4, title: 'Member Lv.4', profileUrl: '' },
    { nickname: 'neko123', level: 12, title: 'Member Lv.12', profileUrl: '' },
    { nickname: 'sora', level: 8, title: 'Member Lv.8', profileUrl: '' }
  ];
  const sample = samples[Math.floor(Math.random() * samples.length)];
  const result = addMember({ ...sample, ...(req.body || {}) });
  res.json({ ok: true, ...result });
});

app.post('/api/test-gift', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  const samples = [
    { nickname: '루리단장', giftName: 'Rose', count: 30, unitValue: 1, profileUrl: '', giftIconUrl: '' },
    { nickname: 'neko123', giftName: 'Galaxy', count: 1, unitValue: 1000, profileUrl: '', giftIconUrl: '' },
    { nickname: '민수', giftName: 'Donut', count: 5, unitValue: 30, profileUrl: '', giftIconUrl: '' },
    { nickname: 'sora', giftName: 'Heart Me', count: 10, unitValue: 5, profileUrl: '', giftIconUrl: '' }
  ];
  const sample = samples[Math.floor(Math.random() * samples.length)];
  const result = addGift({ ...sample, ...(req.body || {}) });
  res.json({ ok: true, ...result });
});

const server = app.listen(PORT, () => {
  console.log(`Gift Board server running on http://localhost:${PORT}`);
  console.log(`Admin token: ${ADMIN_TOKEN}`);
});

const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: 'state', payload: getPublicState() }));
  ws.on('close', () => clients.delete(ws));
});

function broadcastState() {
  const message = JSON.stringify({ type: 'state', payload: getPublicState() });
  for (const client of clients) {
    if (client.readyState === client.OPEN) client.send(message);
  }
}
