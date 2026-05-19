# 張懸的聲音 — 故事牆

一個讓張懸樂迷匿名分享故事的靜態網站，搭配 Supabase 做為後端。

---

## 部署步驟

### 1. 建立 Supabase 專案

1. 前往 [supabase.com](https://supabase.com) 註冊免費帳號
2. 建立新 Project（名稱任意，例如 `deserts-chang`）
3. 進入專案後，點左側 **SQL Editor**，貼上以下 SQL 執行：

```sql
create table stories (
  id         uuid default gen_random_uuid() primary key,
  song       text,
  content    text not null check (char_length(content) >= 10),
  created_at timestamptz default now()
);

alter table stories enable row level security;

create policy "anyone can read"   on stories for select using (true);
create policy "anyone can insert" on stories for insert with check (true);
```

4. 點左側 **Project Settings → API**，複製：
   - `Project URL`
   - `anon public` key

### 2. 填入憑證

打開 `app.js`，把最上面兩行換成你剛才複製的值：

```js
const SUPABASE_URL      = 'https://xxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
```

### 3. 推送到 GitHub 並啟用 Pages

```bash
# 在 deserts-chang-wall 資料夾內
git init
git add .
git commit -m "init: deserts chang story wall"
git branch -M main

# 在 GitHub 建立新 repo，然後：
git remote add origin https://github.com/你的帳號/deserts-chang-wall.git
git push -u origin main
```

4. 到 GitHub repo → **Settings → Pages → Source**，選 `main` branch，Save。
5. 幾分鐘後就會有一個公開網址，例如 `https://你的帳號.github.io/deserts-chang-wall/`

---

## 資料夾結構

```
deserts-chang-wall/
├── index.html   # 頁面結構
├── style.css    # 暖色系樣式
├── app.js       # Supabase 串接 + 互動邏輯
└── README.md
```
