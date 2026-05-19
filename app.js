// ============================================================
const SUPABASE_URL      = 'https://yovtohqazopmbdwgiqxk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdnRvaHFhem9wbWJkd2dpcXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNTkxMjYsImV4cCI6MjA5NDczNTEyNn0.vN0CZ-lGWCrQOum1DT--OQ5Yq3tz9hXH3vydjXwVnp8';
// ============================================================

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State
let currentUser  = null;
let currentStory = null;
let stories      = [];

// DOM
const wall          = document.getElementById('storyWall');
const overlay       = document.getElementById('modalOverlay');
const loginOverlay  = document.getElementById('loginOverlay');
const detailOverlay = document.getElementById('detailOverlay');
const storyText     = document.getElementById('storyText');
const charCount     = document.getElementById('charCount');
const submitBtn     = document.getElementById('submitBtn');
const songSelect    = document.getElementById('songSelect');
const customSong    = document.getElementById('customSong');
const editText      = document.getElementById('editText');
const editCharCount = document.getElementById('editCharCount');

// ── Auth ──────────────────────────────────────────────────────
db.auth.onAuthStateChange((event, session) => {
  currentUser = session?.user ?? null;
  updateAuthBar();
  refreshCardBadges();
});

function updateAuthBar() {
  const userEl     = document.getElementById('authUser');
  const emailEl    = document.getElementById('authEmail');
  const loginBtnEl = document.getElementById('authLoginBtn');

  if (currentUser) {
    emailEl.textContent  = currentUser.email;
    userEl.style.display = '';
    loginBtnEl.style.display = 'none';
  } else {
    userEl.style.display = 'none';
    loginBtnEl.style.display = '';
  }
}

async function logout() {
  await db.auth.signOut();
}

// ── Login Modal ───────────────────────────────────────────────
function openLoginModal() {
  document.getElementById('loginStep1').style.display = '';
  document.getElementById('loginStep2').style.display = 'none';
  document.getElementById('loginEmail').value = '';
  loginOverlay.classList.add('open');
  setTimeout(() => document.getElementById('loginEmail').focus(), 50);
}

function closeLoginModal() {
  loginOverlay.classList.remove('open');
}

loginOverlay.addEventListener('click', e => {
  if (e.target === loginOverlay) closeLoginModal();
});

async function sendMagicLink() {
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) { document.getElementById('loginEmail').focus(); return; }

  const btn = document.getElementById('magicLinkBtn');
  btn.disabled = true;
  btn.textContent = '寄送中…';

  const { error } = await db.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: 'https://danielhu-0112.github.io/deserts-chang-wall/',
    },
  });

  btn.disabled = false;
  btn.textContent = '寄送登入連結';

  if (error) {
    alert('寄送失敗，請確認信箱格式是否正確。');
    return;
  }

  document.getElementById('loginStep1').style.display = 'none';
  document.getElementById('loginStep2').style.display = '';
}

// ── Helpers ───────────────────────────────────────────────────
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

function isOwn(story) {
  return !!(currentUser && story.user_id === currentUser.id);
}

// ── Load Stories ──────────────────────────────────────────────
async function loadStories() {
  const { data, error } = await db
    .from('stories')
    .select('id, song, content, created_at, user_id')
    .order('created_at', { ascending: false });

  document.getElementById('wallLoading')?.remove();

  if (error) {
    wall.innerHTML = '<div class="wall-empty">故事牆暫時無法讀取，請稍後再試。</div>';
    return;
  }

  stories = data;
  if (!stories.length) { showEmpty(); return; }
  stories.forEach(s => wall.appendChild(makeCard(s)));
}

function showEmpty() {
  wall.innerHTML = `
    <div class="wall-empty">
      故事牆還是空的。<br>成為第一個留下故事的人吧。
    </div>`;
}

// 登入/登出後刷新「我的」標記與詳細頁按鈕
function refreshCardBadges() {
  stories.forEach(story => {
    const card = wall.querySelector(`[data-id="${story.id}"]`);
    if (!card) return;
    const badge = card.querySelector('.card-own-badge');
    if (isOwn(story) && !badge) {
      card.querySelector('.card-footer')
        ?.insertAdjacentHTML('beforeend', '<span class="card-own-badge">我的</span>');
    } else if (!isOwn(story) && badge) {
      badge.remove();
    }
  });

  // 如果詳細視窗是開著的也更新
  if (currentStory) {
    document.getElementById('detailActions').style.display =
      isOwn(currentStory) ? '' : 'none';
  }
}

// ── Card ──────────────────────────────────────────────────────
function makeCard(story) {
  const card = document.createElement('div');
  card.className = 'story-card';
  card.dataset.id = story.id;
  card.onclick = () => openDetail(story);

  const preview = story.content.length > 80
    ? story.content.slice(0, 80) + '…'
    : story.content;

  card.innerHTML = `
    ${story.song ? `<div class="card-song">${esc(story.song)}</div>` : ''}
    <div class="card-content">${esc(preview)}</div>
    <div class="card-footer">
      <span class="card-date">${formatDate(story.created_at)}</span>
      ${isOwn(story) ? '<span class="card-own-badge">我的</span>' : ''}
      <span class="card-read">全文 ›</span>
    </div>
  `;

  return card;
}

// ── Detail Modal ──────────────────────────────────────────────
function openDetail(story) {
  currentStory = story;

  const songEl = document.getElementById('detailSong');
  songEl.textContent = story.song || '';
  songEl.style.display = story.song ? '' : 'none';

  document.getElementById('detailContent').textContent = story.content;
  document.getElementById('detailContent').style.display = '';
  document.getElementById('detailDate').textContent = formatDate(story.created_at);
  document.getElementById('detailActions').style.display = isOwn(story) ? '' : 'none';
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
  document.getElementById('detailActions').style.display = isOwn(currentStory) ? '' : 'none';
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
    .eq('id', currentStory.id);

  btn.disabled = false;
  btn.textContent = '儲存修改';

  if (error) { alert('修改失敗，請稍後再試。'); return; }

  currentStory.content = newContent;
  const idx = stories.findIndex(s => s.id === currentStory.id);
  if (idx !== -1) stories[idx].content = newContent;

  document.getElementById('detailContent').textContent = newContent;

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
    .eq('id', currentStory.id);

  if (error) { alert('刪除失敗，請稍後再試。'); return; }

  stories = stories.filter(s => s.id !== currentStory.id);
  wall.querySelector(`[data-id="${currentStory.id}"]`)?.remove();
  if (!wall.querySelector('.story-card')) showEmpty();
  closeDetail();
}

// ── Write Story Modal ─────────────────────────────────────────
function openModal() {
  if (!currentUser) {
    openLoginModal();
    return;
  }
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
  if (e.key === 'Escape') {
    closeModal();
    closeDetail();
    closeLoginModal();
  }
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

  const { data, error } = await db
    .from('stories')
    .insert([{ content, song, user_id: currentUser.id }])
    .select('id, song, content, created_at, user_id')
    .single();

  if (error) {
    alert('張貼失敗，請稍後再試。');
    submitBtn.disabled = false;
    submitBtn.textContent = '張貼到故事牆';
    return;
  }

  stories.unshift(data);
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
(async () => {
  const { data: { session } } = await db.auth.getSession();
  currentUser = session?.user ?? null;
  updateAuthBar();
  await loadStories();
})();
