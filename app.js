// ============================================================
const SUPABASE_URL      = 'https://yovtohqazopmbdwgiqxk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdnRvaHFhem9wbWJkd2dpcXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNTkxMjYsImV4cCI6MjA5NDczNTEyNn0.vN0CZ-lGWCrQOum1DT--OQ5Yq3tz9hXH3vydjXwVnp8';
// ============================================================

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM
const wall         = document.getElementById('storyWall');
const overlay      = document.getElementById('modalOverlay');
const detailOverlay= document.getElementById('detailOverlay');
const storyText    = document.getElementById('storyText');
const charCount    = document.getElementById('charCount');
const submitBtn    = document.getElementById('submitBtn');
const songSelect   = document.getElementById('songSelect');
const customSong   = document.getElementById('customSong');
const editText     = document.getElementById('editText');
const editCharCount= document.getElementById('editCharCount');

let currentStory = null;

// ── Token storage（用 localStorage 辨識自己的故事）──────────
function getMyTokens() {
  try { return JSON.parse(localStorage.getItem('dc_tokens') || '{}'); }
  catch { return {}; }
}

function saveToken(id, token) {
  const t = getMyTokens();
  t[id] = token;
  localStorage.setItem('dc_tokens', JSON.stringify(t));
}

function getToken(id) {
  return id ? (getMyTokens()[id] || null) : null;
}

// ── Helpers ──────────────────────────────────────────────────
function esc(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  const d = new Date(iso);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('.');
}

// ── Load stories ─────────────────────────────────────────────
async function loadStories() {
  const { data, error } = await db
    .from('stories')
    .select('id, song, content, created_at')
    .order('created_at', { ascending: false });

  document.getElementById('wallLoading')?.remove();

  if (error) {
    wall.innerHTML = '<div class="wall-empty">故事牆暫時無法讀取，請稍後再試。</div>';
    return;
  }

  if (!data.length) { showEmpty(); return; }
  data.forEach(s => wall.appendChild(makeCard(s)));
}

function showEmpty() {
  wall.innerHTML = `
    <div class="wall-empty">
      故事牆還是空的。<br>成為第一個留下故事的人吧。
    </div>`;
}

// ── Card（只顯示曲名 + 短預覽）──────────────────────────────
function makeCard(story) {
  const card = document.createElement('div');
  card.className = 'story-card';
  card.dataset.id = story.id;
  card.onclick = () => openDetail(story);

  const preview = story.content.length > 80
    ? story.content.slice(0, 80) + '…'
    : story.content;

  const isOwn = !!getToken(story.id);

  card.innerHTML = `
    ${story.song ? `<div class="card-song">${esc(story.song)}</div>` : ''}
    <div class="card-content">${esc(preview)}</div>
    <div class="card-footer">
      <span class="card-date">${formatDate(story.created_at)}</span>
      ${isOwn ? '<span class="card-own-badge">我的</span>' : ''}
      <span class="card-read">全文 ›</span>
    </div>
  `;

  return card;
}

// ── Detail Modal ──────────────────────────────────────────────
function openDetail(story) {
  currentStory = story;

  const songEl = document.getElementById('detailSong');
  if (story.song) {
    songEl.textContent = story.song;
    songEl.style.display = '';
  } else {
    songEl.style.display = 'none';
  }

  document.getElementById('detailContent').textContent = story.content;
  document.getElementById('detailContent').style.display = '';
  document.getElementById('detailDate').textContent = formatDate(story.created_at);

  const isOwn = !!getToken(story.id);
  document.getElementById('detailActions').style.display = isOwn ? '' : 'none';
  document.getElementById('editMode').style.display = 'none';

  detailOverlay.classList.add('open');
}

function closeDetail() {
  detailOverlay.classList.remove('open');
  currentStory = null;
}

detailOverlay.addEventListener('click', e => {
  if (e.target === detailOverlay) closeDetail();
});

// ── Edit Mode ─────────────────────────────────────────────────
function enterEditMode() {
  editText.value = currentStory.content;
  editCharCount.textContent = currentStory.content.length;
  document.getElementById('detailContent').style.display = 'none';
  document.getElementById('detailActions').style.display = 'none';
  document.getElementById('editMode').style.display = 'block';
  editText.focus();
}

function exitEditMode() {
  document.getElementById('detailContent').style.display = '';
  document.getElementById('detailActions').style.display = currentStory && getToken(currentStory.id) ? '' : 'none';
  document.getElementById('editMode').style.display = 'none';
}

editText.addEventListener('input', () => {
  editCharCount.textContent = editText.value.length;
});

async function saveEdit() {
  const newContent = editText.value.trim();
  if (newContent.length < 10) { alert('請至少輸入 10 個字。'); return; }

  const btn = document.getElementById('saveEditBtn');
  btn.disabled = true;
  btn.textContent = '儲存中…';

  const { error } = await db
    .from('stories')
    .update({ content: newContent })
    .eq('id', currentStory.id)
    .eq('edit_token', getToken(currentStory.id));

  btn.disabled = false;
  btn.textContent = '儲存修改';

  if (error) { alert('修改失敗，請稍後再試。'); return; }

  // 更新本地狀態
  currentStory.content = newContent;
  document.getElementById('detailContent').textContent = newContent;

  // 更新牆上的卡片預覽
  const card = wall.querySelector(`[data-id="${currentStory.id}"]`);
  if (card) {
    const preview = newContent.length > 80 ? newContent.slice(0, 80) + '…' : newContent;
    card.querySelector('.card-content').textContent = preview;
  }

  exitEditMode();
}

// ── Delete ────────────────────────────────────────────────────
async function confirmDelete() {
  if (!confirm('確定要刪除這則故事嗎？刪除後無法復原。')) return;

  const { error } = await db
    .from('stories')
    .delete()
    .eq('id', currentStory.id)
    .eq('edit_token', getToken(currentStory.id));

  if (error) { alert('刪除失敗，請稍後再試。'); return; }

  wall.querySelector(`[data-id="${currentStory.id}"]`)?.remove();
  if (!wall.querySelector('.story-card')) showEmpty();
  closeDetail();
}

// ── Write Story Modal ─────────────────────────────────────────
function openModal() {
  overlay.classList.add('open');
  storyText.focus();
}

function closeModal() {
  overlay.classList.remove('open');
}

overlay.addEventListener('click', e => {
  if (e.target === overlay) closeModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeDetail(); }
});

songSelect.addEventListener('change', () => {
  const isCustom = songSelect.value === '__custom__';
  customSong.classList.toggle('visible', isCustom);
  if (isCustom) customSong.focus();
});

storyText.addEventListener('input', () => {
  charCount.textContent = storyText.value.length;
});

// ── Submit ────────────────────────────────────────────────────
async function submitStory() {
  const content = storyText.value.trim();
  const song = songSelect.value === '__custom__'
    ? (customSong.value.trim() || null)
    : (songSelect.value || null);

  if (!content) { storyText.focus(); return; }
  if (content.length < 10) { alert('請多寫一點，至少 10 個字。'); return; }

  submitBtn.disabled = true;
  submitBtn.textContent = '張貼中…';

  const editToken = crypto.randomUUID();

  const { data, error } = await db
    .from('stories')
    .insert([{ content, song, edit_token: editToken }])
    .select('id, song, content, created_at')
    .single();

  if (error) {
    alert('張貼失敗，請稍後再試。');
    submitBtn.disabled = false;
    submitBtn.textContent = '張貼到故事牆';
    return;
  }

  saveToken(data.id, editToken);

  wall.querySelector('.wall-empty')?.remove();

  const card = makeCard(data);
  card.style.opacity = '0';
  card.style.transition = 'opacity 0.4s';
  wall.insertBefore(card, wall.firstChild);
  requestAnimationFrame(() => { card.style.opacity = '1'; });

  storyText.value = '';
  charCount.textContent = '0';
  songSelect.value = '';
  customSong.value = '';
  customSong.classList.remove('visible');
  submitBtn.disabled = false;
  submitBtn.textContent = '張貼到故事牆';
  closeModal();
}

// ── Init ──────────────────────────────────────────────────────
loadStories();
