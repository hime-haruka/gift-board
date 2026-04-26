const state = { settings: {}, gifts: [] };
const els = {
  board: document.getElementById('board'),
  list: document.getElementById('giftList'),
  empty: document.getElementById('emptyText')
};

init();

async function init() {
  await fetchState();
  connectWs();
}

async function fetchState() {
  const res = await fetch('/api/state');
  const json = await res.json();
  applyState(json);
}

function connectWs() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${location.host}/ws`);
  ws.addEventListener('message', (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === 'state') applyState(message.payload);
    } catch (err) {
      console.error(err);
    }
  });
  ws.addEventListener('close', () => setTimeout(connectWs, 1200));
}

function applyState(next) {
  state.settings = next.settings || {};
  state.gifts = next.gifts || [];
  renderSettings();
  renderItems();
}

function renderSettings() {
  const s = state.settings;
  document.documentElement.style.setProperty('--font-size', `${s.fontSize || 13}px`);
  document.documentElement.style.setProperty('--card-gap', `${s.cardGap ?? 6}px`);
  document.documentElement.style.setProperty('--card-height', `${s.cardHeight || 42}px`);
  document.documentElement.style.setProperty('--bg-opacity', `${s.backgroundOpacity ?? 0.72}`);
}

function renderItems() {
  const s = state.settings;
  els.empty.classList.toggle('is-visible', state.gifts.length === 0);
  els.list.innerHTML = state.gifts.map((item) => itemTemplate(item, s)).join('');
}

function itemTemplate(item, s) {
  if (item.type === 'member') return memberTemplate(item, s);
  return giftTemplate(item, s);
}

function giftTemplate(gift, s) {
  const avatar = gift.profileUrl || `https://api.dicebear.com/8.x/thumbs/svg?seed=${encodeURIComponent(gift.nickname || 'user')}`;
  const giftIcon = gift.giftIconUrl || `https://api.dicebear.com/8.x/shapes/svg?seed=${encodeURIComponent(gift.giftName || 'gift')}`;
  const count = Number(gift.count || 1).toLocaleString();
  const value = Number(gift.totalValue || 0).toLocaleString();
  return `
    <article class="gift-card gift-card--gift">
      <img class="avatar ${s.showProfile ? '' : 'is-hidden'}" src="${escapeAttr(avatar)}" alt="" />
      <div class="nickname">${escapeHtml(gift.nickname)}</div>
      <img class="gift-icon ${s.showGiftIcon ? '' : 'is-hidden'}" src="${escapeAttr(giftIcon)}" alt="" />
      <div class="gift-label">${escapeHtml(gift.giftName)} × ${count}</div>
      <div class="value ${s.showValue ? '' : 'is-hidden'}">(💎${value})</div>
    </article>
  `;
}

function memberTemplate(member, s) {
  const avatar = member.profileUrl || `https://api.dicebear.com/8.x/thumbs/svg?seed=${encodeURIComponent(member.nickname || 'member')}`;
  const levelText = member.level ? ` Lv.${Number(member.level).toLocaleString()}` : '';
  return `
    <article class="gift-card gift-card--member">
      <img class="avatar ${s.showProfile ? '' : 'is-hidden'}" src="${escapeAttr(avatar)}" alt="" />
      <div class="member-line"><span class="member-name">${escapeHtml(member.nickname)}</span> 님이 멤버 레벨 업!${escapeHtml(levelText)}</div>
    </article>
  `;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
}
function escapeAttr(value) { return escapeHtml(value); }
