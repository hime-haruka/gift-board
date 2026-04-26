const board = document.getElementById('board');

let settings = {};
let items = [];
let lastRenderKey = '';

function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>'"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[c]));
}

function fallbackAvatar(name) {
  const first = String(name || '?').trim().slice(0, 1) || '?';
  return `<span>${escapeHtml(first)}</span>`;
}

function settingBool(...keys) {
  for (const key of keys) {
    if (settings[key] !== undefined) return Boolean(settings[key]);
  }
  return false;
}

function settingNumber(defaultValue, ...keys) {
  for (const key of keys) {
    const value = Number(settings[key]);
    if (!Number.isNaN(value)) return value;
  }
  return defaultValue;
}

function renderAvatar(item) {
  const showProfiles = settingBool('showProfiles', 'showProfile');

  if (!showProfiles) return '';

  if (item.profileImage) {
    return `
      <div class="avatar">
        <img src="${escapeHtml(item.profileImage)}" onerror="this.remove()">
      </div>
    `;
  }

  return `
    <div class="avatar">
      ${fallbackAvatar(item.nickname)}
    </div>
  `;
}

function getDiamondValue(item) {
  return Number(
    item.totalDiamond ??
    item.value ??
    item.diamond ??
    item.diamondCount ??
    0
  ) || 0;
}

function getGiftCount(item) {
  return Number(item.count ?? item.repeatCount ?? 1) || 1;
}

function applyCssSettings() {
  const fontSize = settingNumber(20, 'fontSize');
  const rawOpacity = settingNumber(96, 'cardOpacity');

  const opacity = rawOpacity > 1
    ? Math.max(0, Math.min(100, rawOpacity)) / 100
    : Math.max(0, Math.min(1, rawOpacity));

  document.documentElement.style.setProperty('--font-size', `${fontSize}px`);
  document.documentElement.style.setProperty('--card-opacity', `${opacity}`);
}

function render() {
  applyCssSettings();

  board.innerHTML = items.map(item => {
    const showProfiles = settingBool('showProfiles', 'showProfile');
    const noProfile = !showProfiles ? ' no-profile' : '';

    if (item.type === 'member_level') {
      const level = item.level || 1;

      return `
        <article class="card member${noProfile}">
          ${renderAvatar(item)}
          <div class="name">${escapeHtml(item.nickname)} 님이 멤버 레벨 업!</div>
          <div class="right member-text">Lv.${escapeHtml(level)}</div>
        </article>
      `;
    }

    const showGiftImage = settingBool('showGiftImage');
    const showDiamond = settingBool('showDiamondValue');

    const giftImage = showGiftImage && item.giftImage
      ? `<img class="gift-img" src="${escapeHtml(item.giftImage)}" onerror="this.classList.add('hidden')">`
      : '';

    const diamondValue = getDiamondValue(item);
    const diamond = showDiamond
      ? `<span class="diamond">(💎${diamondValue.toLocaleString('ko-KR')})</span>`
      : '';

    const giftName = item.giftName || 'Gift';
    const count = getGiftCount(item);

    return `
      <article class="card gift${noProfile}">
        ${renderAvatar(item)}
        <div class="name">${escapeHtml(item.nickname)}</div>
        <div class="right">
          ${giftImage}
          <span>${escapeHtml(giftName)} × ${escapeHtml(count)}</span>
          ${diamond}
        </div>
      </article>
    `;
  }).join('');
}

function normalizeState(data) {
  settings = data.settings || {};
  items = data.events || data.items || [];
}

async function loadState() {
  try {
    const res = await fetch('/api/state', { cache: 'no-store' });
    const data = await res.json();

    normalizeState(data);

    const key = JSON.stringify({ settings, items });

    if (key !== lastRenderKey) {
      lastRenderKey = key;
      render();
    }
  } catch (err) {
    console.error('Overlay fetch error:', err);
  }
}

/* 핵심: WebSocket 제거됨 */
loadState();
setInterval(loadState, 1000);
