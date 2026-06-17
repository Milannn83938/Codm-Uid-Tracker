# TrackUIDS — COD:Mobile Global UID Tracker

Community-powered UID tracker for COD:Mobile Global server. Search any UID to see current name, name history, streamer mode alias, and last activity.

## Features
- 🔍 Search by UID or player name
- 📋 Full name history (detects name changes)
- 🎭 Streamer mode alias tracking
- 🟢 Activity log
- 🔔 Personal watchlist (per browser)
- 🌍 Shared database — everyone contributes, everyone benefits

## How to deploy FREE in 5 minutes

### Option A — Railway (easiest)
1. Go to https://railway.app and sign up (free)
2. Click **New Project → Deploy from GitHub repo**
3. Upload this folder to a GitHub repo first, then connect it
4. Railway auto-detects Node.js and runs `npm start`
5. Click **Generate Domain** — you get a free URL like `trackuids.up.railway.app`

### Option B — Render
1. Go to https://render.com and sign up (free)
2. Click **New → Web Service**
3. Connect your GitHub repo containing this folder
4. Set:
   - Build command: `npm install`
   - Start command: `node server.js`
5. Deploy — free URL provided

### Option C — Run locally
```bash
npm install
node server.js
# Open http://localhost:3000
```

## How it works
- Data is stored in `data/db.json` on the server
- Players are logged manually by users via the "Log UID" tab
- Name changes are automatically detected when the same UID is updated with a different name
- The watchlist is stored per-browser (localStorage) — not shared

## API Endpoints
- `GET /api/player/:uid` — look up a UID
- `POST /api/player` — log/update a player
- `GET /api/recent` — recently logged players
- `GET /api/search?q=name` — search by name

## File structure
```
trackuids/
├── server.js        ← backend (Node.js + Express)
├── package.json
├── data/
│   └── db.json      ← database (auto-created)
└── public/
    └── index.html   ← frontend
```
