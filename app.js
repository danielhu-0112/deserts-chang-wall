// ============================================================
// 設定：在 Supabase 建好專案後，把下面兩個值換成你的
// ============================================================
const SUPABASE_URL      = 'https://yovtohqazopmbdwgiqxk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdnRvaHFhem9wbWJkd2dpcXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNTkxMjYsImV4cCI6MjA5NDczNTEyNn0.vN0CZ-lGWCrQOum1DT--OQ5Yq3tz9hXH3vydjXwVnp8';
// ============================================================

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM refs
const wall       = document.getElementById('storyWall');
const overlay    = document.getElementById('modalOverlay');
const storyText  = document.getElementById('storyText');
const charCount  = document.getElementById('charCount');
const submitBtn  = document.getElementById('submitBtn');
const songSelect = document.getElementById('songSelect');
const customSong = document.getElementById('customSong');

// ── Load stories ────────────────────────────────────────────
async function loadStories() {
  const { data, error } = await db
    .from('stories')
    .select('id, song, content, created_at')
    .order('created_at', { ascending: false });

  document.getElementById('wallLoading')?.remove();

  if (error) {
    wall.innerHTML = '<div class="wall-empty">故事牆暫時無法讀取，請稍後再試。</div>';
    console.error(error);
    return;
  }

  if (!data.length) {
    showEmpty();
    return;
  }

  data.forEach(s => wall.appendChild(makeCard(s)));
}

function showEmpty() {
  wall.innerHTML = `
    <div class="wall-empty">
      故事牆還是空的。<br>
      成為第一個留下故事的人吧。
    </div>`;
}

// ── Build card element ───────────────────────────────────────
function makeCard(story) {
  const card = document.createElement('div');
  card.className = 'story-card';

  const d = new Date(story.created_at);
  const dateStr = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('.');

  card.innerHTML = `
    ${story.song ? `<div class="card-song">${esc(story.song)}</div>` : ''}
    <div class="card-content">${esc(story.content)}</div>
    <div class="card-date">${dateStr}</div>
  `;

  return card;
}

function esc(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Modal ────────────────────────────────────────────────────
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
  if (e.key === 'Escape') closeModal();
});

// ── Custom song toggle ───────────────────────────────────────
songSelect.addEventListener('change', () => {
  customSong.classList.toggle('visible', songSelect.value === '__custom__');
  if (songSelect.value === '__custom__') customSong.focus();
});

// ── Char counter ─────────────────────────────────────────────
storyText.addEventListener('input', () => {
  charCount.textContent = storyText.value.length;
});

// ── Submit ───────────────────────────────────────────────────
async function submitStory() {
  const content = storyText.value.trim();
  const song    = songSelect.value === '__custom__'
    ? (customSong.value.trim() || null)
    : (songSelect.value || null);

  if (!content) { storyText.focus(); return; }
  if (content.length < 10) {
    alert('請多寫一點，至少 10 個字。');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = '張貼中…';

  const { data, error } = await db
    .from('stories')
    .insert([{ content, song }])
    .select('id, song, content, created_at')
    .single();

  if (error) {
    alert('張貼失敗，請稍後再試。');
    console.error(error);
    submitBtn.disabled = false;
    submitBtn.textContent = '張貼到故事牆';
    return;
  }

  // Remove empty state if present
  wall.querySelector('.wall-empty')?.remove();

  // Prepend new card
  const card = makeCard(data);
  card.style.opacity = '0';
  card.style.transition = 'opacity 0.4s';
  wall.insertBefore(card, wall.firstChild);
  requestAnimationFrame(() => { card.style.opacity = '1'; });

  // Reset form
  storyText.value = '';
  charCount.textContent = '0';
  songSelect.value = '';
  customSong.value = '';
  customSong.classList.remove('visible');
  submitBtn.disabled = false;
  submitBtn.textContent = '張貼到故事牆';
  closeModal();
}

// ── Init ─────────────────────────────────────────────────────
loadStories();
