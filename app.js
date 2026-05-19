// ============================================================
const SUPABASE_URL      = 'https://yovtohqazopmbdwgiqxk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdnRvaHFhem9wbWJkd2dpcXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNTkxMjYsImV4cCI6MjA5NDczNTEyNn0.vN0CZ-lGWCrQOum1DT--OQ5Yq3tz9hXH3vydjXwVnp8';
// ============================================================

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Album map（歌名 → 專輯）─────────────────────────────────
const ALBUM_MAP = {
  'My Life Will...': [
    'Scream','寶貝（in the night）','迷惑','So?!...',"Ain't My Man",
    'My Life Will','Live 酒館300秒','信任的樣子','無狀態','Malaimo','寶貝（in a day）',
  ],
  '親愛的...我還不知道': [
    '畢竟','嫁禍進行式','喜歡','親愛的','Gonna Stop',
    '兒歌','模樣','討人厭的字','欲望把眼前的地板舖滿','Outro','並不',
  ],
  '城市': [
    '關於我愛你','Beautiful Woman','Selling','南國的孩子','島嶼雲煙',
    '就在','Stay-牡蠣之歌','城市','Love, New Year','巷口',
  ],
  '神的遊戲': [
    '玫瑰色的你','藍天白雲','兩者','如何','危險的，是',
    'triste','我想你要走了','艷火','日子',
  ],
  '9522': [
    'idiot','silence of desire','李小龍','白吃白喝','Miss Missed Love',
    '說說罷了','train to heaven','深夜，you were on my mind','這世界如此美好',
    'deserts ride','女仞之詩','不識相','沒有寄的信','最好的時光','天高地闊',
  ],
};

function getAlbum(song) {
  if (!song) return null;
  for (const [album, songs] of Object.entries(ALBUM_MAP)) {
    if (songs.includes(song)) return album;
  }
  return 'custom';
}

// ── State ─────────────────────────────────────────────────────
let currentUser  = null;
let currentStory = null;
let stories      = [];
let sortMode     = 'newest';
let albumFilter  = 'all';

// ── DOM ───────────────────────────────────────────────────────
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
    emailEl.textContent      = currentUser.email;
    userEl.style.display     = '';
    loginBtnEl.style.display = 'none';
  } else {
    userEl.style.display     = 'none';
    loginBtnEl.style.display = '';
  }
}

async function logout() { await db.auth.signOut(); }

// ── Login Modal ───────────────────────────────────────────────
function openLoginModal() {
  document.getElementById('loginStep1').style.display = '';
  document.getElementById('loginStep2').style.display = 'none';
  document.getElementById('loginEmail').value = '';
  loginOverlay.classList.add('open');
  setTimeout(() => document.getElementById('loginEmail').focus(), 50);
}

function closeLoginModal() { loginOverlay.classList.remove('open'); }

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
    options: { emailRedirectTo: 'https://danielhu-0112.github.io/deserts-chang-wall/' },
  });

  btn.disabled = false;
  btn.textContent = '寄送登入連結';

  if (error) { alert('寄送失敗，請確認信箱格式是否正確。'); return; }

  document.getElementById('loginStep1').style.display = 'none';
  document.getElementById('loginStep2').style.display = '';
}

// ── Helpers ───────────────────────────────────────────────────
function esc(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(iso) {
  const d = new Date(iso);
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('.');
}

function isOwn(story) {
  return !!(currentUser && story.user_id === currentUser.id);
}

function fmtViews(n) {
  return n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n);
}

// ── Filter / Sort ─────────────────────────────────────────────
document.querySelectorAll('[data-sort]').forEach(btn => {
  btn.addEventListener('click', () => {
    sortMode = btn.dataset.sort;
    document.querySelectorAll('[data-sort]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderWall();
  });
});

document.querySelectorAll('[data-album]').forEach(btn => {
  btn.addEventListener('click', () => {
    albumFilter = btn.dataset.album;
    document.querySelectorAll('[data-album]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderWall();
  });
});

function getFilteredSorted() {
  let result = [...stories];

  if (albumFilter !== 'all') {
    result = result.filter(s => {
      const album = getAlbum(s.song);
      if (albumFilter === 'nosong') return !s.song;
      if (albumFilter === 'custom') return album === 'custom';
      return album === albumFilter;
    });
  }

  if (sortMode === 'newest') {
    result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } else if (sortMode === 'views-desc') {
    result.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
  } else if (sortMode === 'views-asc') {
    result.sort((a, b) => (a.view_count || 0) - (b.view_count || 0));
  }

  return result;
}

function renderWall() {
  wall.querySelectorAll('.story-card, .wall-empty').forEach(el => el.remove());
  const filtered = getFilteredSorted();
  if (!filtered.length) {
    wall.insertAdjacentHTML('beforeend', '<div class="wall-empty">沒有符合條件的故事。</div>');
    return;
  }
  filtered.forEach(s => wall.appendChild(makeCard(s)));
}

// ── Load Stories ──────────────────────────────────────────────
async function loadStories() {
  const { data, error } = await db
    .from('stories')
    .select('id, song, content, created_at, user_id, view_count')
    .order('created_at', { ascending: false });

  document.getElementById('wallLoading')?.remove();

  if (error) {
    wall.innerHTML = '<div class="wall-empty">故事牆暫時無法讀取，請稍後再試。</div>';
    return;
  }

  stories = data;
  if (!stories.length) { showEmpty(); return; }
  renderWall();
}

function showEmpty() {
  wall.innerHTML = '<div class="wall-empty">故事牆還是空的。<br>成為第一個留下故事的人吧。</div>';
}

function refreshCardBadges() {
  stories.forEach(story => {
    const card = wall.querySelector(`[data-id="${story.id}"]`);
    if (!card) return;
    const badge = card.querySelector('.card-own-badge');
    if (isOwn(story) && !badge) {
      card.querySelector('.card-date')?.insertAdjacentHTML('afterend', '<span class="card-own-badge">我的</span>');
    } else if (!isOwn(story) && badge) {
      badge.remove();
    }
  });
  if (currentStory) {
    document.getElementById('detailActions').style.display = isOwn(currentStory) ? '' : 'none';
  }
}

// ── Card ──────────────────────────────────────────────────────
function makeCard(story) {
  const card = document.createElement('div');
  card.className = 'story-card';
  card.dataset.id = story.id;
  card.onclick = () => openDetail(story);

  const preview = story.content.length > 80 ? story.content.slice(0, 80) + '…' : story.content;
  const views   = story.view_count || 0;

  card.innerHTML = `
    <div class="card-views">閱 ${fmtViews(views)}</div>
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
async function openDetail(story) {
  currentStory = story;

  const songEl = document.getElementById('detailSong');
  songEl.textContent    = story.song || '';
  songEl.style.display  = story.song ? '' : 'none';
  document.getElementById('detailContent').textContent  = story.content;
  document.getElementById('detailContent').style.display = '';
  document.getElementById('detailDate').textContent     = formatDate(story.created_at);
  document.getElementById('detailActions').style.display = isOwn(story) ? '' : 'none';
  document.getElementById('editMode').style.display     = 'none';

  detailOverlay.classList.add('open');

  // 計數 & 更新
  db.rpc('increment_view', { story_id: story.id });
  story.view_count = (story.view_count || 0) + 1;
  const card = wall.querySelector(`[data-id="${story.id}"]`);
  if (card) card.querySelector('.card-views').textContent = `閱 ${fmtViews(story.view_count)}`;
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

editText.addEventListener('input', () => { editCharCount.textContent = editText.value.length; });

async function saveEdit() {
  const newContent = editText.value.trim();
  if (newContent.length < 10) { alert('請至少輸入 10 個字。'); return; }

  const btn = document.getElementById('saveEditBtn');
  btn.disabled = true;
  btn.textContent = '儲存中…';

  const { error } = await db.from('stories').update({ content: newContent }).eq('id', currentStory.id);

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

  const { error } = await db.from('stories').delete().eq('id', currentStory.id);
  if (error) { alert('刪除失敗，請稍後再試。'); return; }

  stories = stories.filter(s => s.id !== currentStory.id);
  wall.querySelector(`[data-id="${currentStory.id}"]`)?.remove();
  if (!wall.querySelector('.story-card')) showEmpty();
  closeDetail();
}

// ── Write Story Modal ─────────────────────────────────────────
function openModal() {
  if (!currentUser) { openLoginModal(); return; }
  overlay.classList.add('open');
  storyText.focus();
}

function closeModal() { overlay.classList.remove('open'); }

overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeDetail(); closeLoginModal(); }
});

songSelect.addEventListener('change', () => {
  const isCustom = songSelect.value === '__custom__';
  customSong.classList.toggle('visible', isCustom);
  if (isCustom) customSong.focus();
});

storyText.addEventListener('input', () => { charCount.textContent = storyText.value.length; });

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
    .insert([{ content, song, user_id: currentUser.id, view_count: 0 }])
    .select('id, song, content, created_at, user_id, view_count')
    .single();

  if (error) {
    alert('張貼失敗，請稍後再試。');
    submitBtn.disabled = false;
    submitBtn.textContent = '張貼到故事牆';
    return;
  }

  stories.unshift(data);
  wall.querySelector('.wall-empty')?.remove();

  // 只有在「最新」排序且「全部」篩選時直接插入，否則重新渲染
  if (sortMode === 'newest' && albumFilter === 'all') {
    const card = makeCard(data);
    card.style.opacity = '0';
    card.style.transition = 'opacity 0.4s';
    wall.insertBefore(card, wall.firstChild);
    requestAnimationFrame(() => { card.style.opacity = '1'; });
  } else {
    renderWall();
  }

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
