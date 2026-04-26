const board = document.getElementById('board');
let settings = {};
let items = [];

function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function fallbackAvatar(name) {
  const first = String(name || '?').trim().slice(0,1) || '?';
  return `<span>${escapeHtml(first)}</span>`;
}

function renderAvatar(item) {
  if (!settings.showProfiles) return '';
  if (item.profileImage) return `<div class="avatar"><img src="${escapeHtml(item.profileImage)}" onerror="this.remove()"></div>`;
  return `<div class="avatar">${fallbackAvatar(item.nickname)}</div>`;
}

function render() {
  document.documentElement.style.setProperty('--font-size', `${settings.fontSize || 20}px`);
  document.documentElement.style.setProperty('--card-opacity', `${Math.max(0, Math.min(100, settings.cardOpacity ?? 96)) / 100}`);

  board.innerHTML = items.map(item => {
    const noProfile = !settings.showProfiles ? ' no-profile' : '';
    if (item.type === 'member_level') {
      return `<article class="card member${noProfile}">
        ${renderAvatar(item)}
        <div class="name">${escapeHtml(item.nickname)} 님이 멤버 레벨 업!</div>
        <div class="right member-text">Lv.${escapeHtml(item.level || 1)}</div>
      </article>`;
    }

    const giftImage = settings.showGiftImage && item.giftImage
      ? `<img class="gift-img" src="${escapeHtml(item.giftImage)}" onerror="this.classList.add('hidden')">`
      : '';
    const diamond = settings.showDiamondValue ? `<span class="diamond">(💎${Number(item.value || 0).toLocaleString('ko-KR')})</span>` : '';
    return `<article class="card gift${noProfile}">
      ${renderAvatar(item)}
      <div class="name">${escapeHtml(item.nickname)}</div>
      <div class="right">${giftImage}<span>${escapeHtml(item.giftName)} × ${escapeHtml(item.count || 1)}</span>${diamond}</div>
    </article>`;
  }).join('');
}

async function loadState() {
  const res = await fetch('/api/state', { cache: 'no-store' });
  const data = await res.json();
  settings = data.settings || {};
  items = data.items || [];
  render();
}

function connectWs() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}`);
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'state') {
        settings = data.settings || settings;
        items = data.items || items;
        render();
      }
    } catch {}
  };
  ws.onclose = () => setTimeout(connectWs, 1500);
}

loadState();
connectWs();
