const form = document.getElementById('settingsForm');
const tokenInput = document.getElementById('token');
const saveTokenBtn = document.getElementById('saveTokenBtn');
const statusEl = document.getElementById('status');
const testGiftBtn = document.getElementById('testGiftBtn');
const testMemberBtn = document.getElementById('testMemberBtn');
const clearBtn = document.getElementById('clearBtn');
const manualGiftForm = document.getElementById('manualGiftForm');
const giftPreview = document.getElementById('giftPreview');

let token = new URLSearchParams(location.search).get('token') || localStorage.getItem('giftBoardAdminToken') || 'dev-token';
tokenInput.value = token;

init();

async function init() {
  await loadState();
  connectWs();
}

saveTokenBtn.addEventListener('click', () => {
  token = tokenInput.value.trim();
  localStorage.setItem('giftBoardAdminToken', token);
  setStatus('토큰 저장됨');
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const settings = readSettingsFromForm();
  await api('/api/settings', settings);
  setStatus('설정 저장 완료');
});

testGiftBtn.addEventListener('click', async () => {
  await api('/api/test-gift', {});
  setStatus('테스트 기프트 전송');
});

testMemberBtn.addEventListener('click', async () => {
  await api('/api/test-member', {});
  setStatus('테스트 멤버 레벨업 전송');
});

clearBtn.addEventListener('click', async () => {
  if (!confirm('현재 리스트를 초기화할까요?')) return;
  await api('/api/clear', {});
  setStatus('리스트 초기화 완료');
});

manualGiftForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(manualGiftForm));
  data.count = Number(data.count || 1);
  data.unitValue = Number(data.unitValue || 0);
  await api('/api/gift', data);
  setStatus('수동 기프트 추가 완료');
});

async function loadState() {
  const res = await fetch('/api/state');
  const state = await res.json();
  fillForm(state.settings);
  renderPreview(state.gifts);
  setStatus('연결됨');
}

async function api(url, body) {
  const res = await fetch(`${url}?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    setStatus(json.error || '요청 실패');
    throw new Error(json.error || 'Request failed');
  }
  return json;
}

function connectWs() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${location.host}/ws`);
  ws.addEventListener('message', (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === 'state') {
        fillForm(message.payload.settings);
        renderPreview(message.payload.gifts);
      }
    } catch (err) { console.error(err); }
  });
  ws.addEventListener('open', () => setStatus('실시간 연결됨'));
  ws.addEventListener('close', () => {
    setStatus('재연결 중');
    setTimeout(connectWs, 1200);
  });
}

function fillForm(settings) {
  for (const [key, value] of Object.entries(settings || {})) {
    const field = form.elements[key];
    if (!field) continue;
    if (field.type === 'checkbox') field.checked = Boolean(value);
    else field.value = value;
  }
}

function readSettingsFromForm() {
  const data = Object.fromEntries(new FormData(form));
  for (const el of form.querySelectorAll('input[type="checkbox"]')) data[el.name] = el.checked;
  for (const key of ['maxItems', 'minValue', 'fontSize', 'cardHeight', 'cardGap', 'backgroundOpacity', 'mergeWindowMs']) {
    data[key] = Number(data[key]);
  }
  return data;
}

function renderPreview(items = []) {
  giftPreview.innerHTML = items.length ? items.map((item) => {
    if (item.type === 'member') {
      return `<div class="preview-item"><span>⭐ ${escapeHtml(item.nickname)} · ${escapeHtml(item.title || 'Member Level Up')}</span><b>${item.level ? `Lv.${Number(item.level).toLocaleString()}` : ''}</b></div>`;
    }
    return `<div class="preview-item"><span>🎁 ${escapeHtml(item.nickname)} · ${escapeHtml(item.giftName)} × ${Number(item.count).toLocaleString()}</span><b>💎${Number(item.totalValue).toLocaleString()}</b></div>`;
  }).join('') : '<p class="hint">표시 중인 항목이 없습니다.</p>';
}

function setStatus(text) { statusEl.textContent = text; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char])); }
