const $ = id => document.getElementById(id);
const fields = ['maxItems','minValue','fontSize','cardOpacity','showProfiles','showGiftImage','showDiamondValue'];

function token() { return $('token').value.trim(); }
function setStatus(msg) { $('status').textContent = msg; }

function readSettings() {
  return {
    maxItems: Number($('maxItems').value || 10),
    minValue: Number($('minValue').value || 0),
    fontSize: Number($('fontSize').value || 20),
    cardOpacity: Number($('cardOpacity').value || 96),
    showProfiles: $('showProfiles').checked,
    showGiftImage: $('showGiftImage').checked,
    showDiamondValue: $('showDiamondValue').checked,
  };
}

function fillSettings(s) {
  $('maxItems').value = s.maxItems ?? 10;
  $('minValue').value = s.minValue ?? 0;
  $('fontSize').value = s.fontSize ?? 20;
  $('cardOpacity').value = s.cardOpacity ?? 96;
  $('showProfiles').checked = !!s.showProfiles;
  $('showGiftImage').checked = !!s.showGiftImage;
  $('showDiamondValue').checked = !!s.showDiamondValue;
  syncLabels();
}

function syncLabels() {
  $('fontSizeText').textContent = `${$('fontSize').value}px`;
  $('opacityText').textContent = `${$('cardOpacity').value}%`;
}

async function post(url, body = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': token() },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '요청 실패');
  return data;
}

async function load() {
  const res = await fetch('/api/state', { cache: 'no-store' });
  const data = await res.json();
  fillSettings(data.settings || {});
}

$('fontSize').addEventListener('input', syncLabels);
$('cardOpacity').addEventListener('input', syncLabels);
$('save').addEventListener('click', async () => {
  try { await post('/api/settings', readSettings()); setStatus('설정 저장 완료'); }
  catch (e) { setStatus(`오류: ${e.message}`); }
});
$('testGift').addEventListener('click', async () => {
  try { await post('/api/test/gift', {}); setStatus('테스트 기프트 전송 완료'); }
  catch (e) { setStatus(`오류: ${e.message}`); }
});
$('testMember').addEventListener('click', async () => {
  try { await post('/api/test/member', {}); setStatus('멤버 레벨업 테스트 전송 완료'); }
  catch (e) { setStatus(`오류: ${e.message}`); }
});
$('clear').addEventListener('click', async () => {
  try { await post('/api/clear', {}); setStatus('리스트 초기화 완료'); }
  catch (e) { setStatus(`오류: ${e.message}`); }
});

load();
