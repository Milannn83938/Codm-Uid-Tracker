const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json());

// Force correct headers so JS runs
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) return { players: {} };
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch { return { players: {} }; }
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

app.get('/api/player/:uid', (req, res) => {
  const db = readDB();
  const player = db.players[req.params.uid];
  if (!player) return res.status(404).json({ error: 'UID not found' });
  res.json(player);
});

app.post('/api/player', (req, res) => {
  const { uid, name, rank, level, streamer, prevNames, lastSeen } = req.body;
  if (!uid || !name) return res.status(400).json({ error: 'uid and name required' });
  const db = readDB();
  const now = new Date().toLocaleDateString('en-GB');
  const existing = db.players[uid];
  if (existing) {
    if (existing.name !== name) {
      existing.names = [
        { name, date: 'Updated ' + now, cur: true },
        ...(existing.names || [{ name: existing.name, date: 'Previous', cur: false }]).map(n => ({ ...n, cur: false }))
      ];
      existing.name = name;
      existing.activity = existing.activity || [];
      existing.activity.unshift({ on: true, txt: 'Name changed to ' + name, time: now });
    }
    if (rank) existing.rank = rank;
    if (level) existing.level = level;
    if (streamer) existing.streamer = streamer;
    if (lastSeen) {
      existing.lastSeen = lastSeen;
      existing.activity = existing.activity || [];
      existing.activity.unshift({ on: true, txt: 'Seen: ' + lastSeen, time: now });
    }
    existing.updatedAt = now;
  } else {
    const names = [
      { name, date: 'Logged ' + now, cur: true },
      ...(prevNames || []).map((n, i) => ({ name: n, date: 'Previous name #' + (i + 1), cur: false }))
    ];
    db.players[uid] = {
      uid, name, rank: rank || null, level: level || null,
      streamer: streamer || null, lastSeen: lastSeen || null,
      names, activity: lastSeen ? [{ on: true, txt: 'Logged: ' + lastSeen, time: now }] : [],
      loggedAt: now, updatedAt: now
    };
  }
  writeDB(db);
  res.json({ success: true, player: db.players[uid] });
});

app.get('/api/recent', (req, res) => {
  const db = readDB();
  const players = Object.values(db.players)
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .slice(0, 20);
  res.json(players);
});

app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  if (!q) return res.json([]);
  const db = readDB();
  const results = Object.values(db.players).filter(p =>
    p.name.toLowerCase().includes(q) ||
    (p.streamer || '').toLowerCase().includes(q) ||
    (p.names || []).some(n => n.name.toLowerCase().includes(q))
  ).slice(0, 20);
  res.json(results);
});

app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(getHTML());
});

app.use((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(getHTML());
});

function getHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TrackUIDS</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Inter', sans-serif; background: #0f0f0f; color: #f0f0f0; min-height: 100vh; font-size: 14px; }
nav { display: flex; align-items: center; justify-content: space-between; padding: 0 20px; height: 54px; border-bottom: 1px solid rgba(255,255,255,0.08); background: #0f0f0f; }
.logo { font-size: 16px; font-weight: 600; }
.logo span { color: #3b82f6; }
.nav-tag { font-size: 10px; background: rgba(59,130,246,0.15); color: #3b82f6; padding: 2px 8px; border-radius: 20px; margin-left: 8px; }
.container { max-width: 700px; margin: 0 auto; padding: 20px 16px; }
.tabs { display: flex; background: #161616; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 3px; margin-bottom: 20px; gap: 2px; }
.tab { flex: 1; padding: 10px 4px; font-size: 13px; font-family: 'Inter', sans-serif; border: none; border-radius: 6px; background: transparent; color: #888; cursor: pointer; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
.tab.active { background: #1e1e1e; color: #f0f0f0; font-weight: 500; border: 1px solid rgba(255,255,255,0.12); }
.page { display: none; }
.page.active { display: block; }
.search-box { background: #161616; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 14px; margin-bottom: 18px; }
.srow { display: flex; gap: 8px; }
input { background: #1e1e1e; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 10px 12px; font-size: 14px; color: #f0f0f0; outline: none; font-family: 'Inter', sans-serif; width: 100%; -webkit-appearance: none; }
input:focus { border-color: #3b82f6; }
.hint { font-size: 12px; color: #555; margin-top: 7px; }
.btn { background: #3b82f6; color: #fff; border: none; border-radius: 6px; padding: 10px 18px; font-size: 14px; font-weight: 500; font-family: 'Inter', sans-serif; cursor: pointer; white-space: nowrap; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.btn:active { opacity: 0.8; }
.btn-outline { background: #1e1e1e; border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; padding: 9px 14px; font-size: 13px; font-family: 'Inter', sans-serif; color: #888; cursor: pointer; width: 100%; margin-top: 10px; touch-action: manipulation; }
.card { background: #161616; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 16px; margin-bottom: 12px; }
.sec { font-size: 10px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
.pname { font-size: 22px; font-weight: 600; margin-bottom: 4px; }
.uid-mono { font-family: monospace; font-size: 11px; color: #555; margin-bottom: 12px; }
.badges { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.badge { font-size: 11px; padding: 3px 10px; border-radius: 20px; font-weight: 500; }
.b-blue { background: rgba(59,130,246,0.15); color: #3b82f6; }
.b-amber { background: rgba(245,158,11,0.15); color: #f59e0b; }
.b-green { background: rgba(34,197,94,0.15); color: #22c55e; }
.b-gray { background: rgba(255,255,255,0.06); color: #888; }
.name-row { display: flex; align-items: center; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 13px; }
.name-row:last-child { border-bottom: none; }
.name-cur { color: #3b82f6; font-weight: 500; }
.name-date { font-size: 12px; color: #555; }
.cur-tag { font-size: 10px; background: rgba(59,130,246,0.15); color: #3b82f6; padding: 2px 7px; border-radius: 20px; margin-right: 5px; }
.streamer-pill { display: inline-block; background: rgba(245,158,11,0.15); color: #f59e0b; font-size: 14px; font-weight: 600; padding: 6px 16px; border-radius: 6px; border: 1px solid rgba(245,158,11,0.2); }
.act-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 13px; }
.act-row:last-child { border-bottom: none; }
.dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.d-on { background: #22c55e; }
.d-off { background: #555; }
.act-t { font-size: 11px; color: #555; margin-left: auto; }
.hero { text-align: center; padding: 40px 10px; }
.hero h1 { font-size: 26px; font-weight: 600; margin-bottom: 10px; }
.hero h1 span { color: #3b82f6; }
.hero p { font-size: 14px; color: #888; max-width: 360px; margin: 0 auto 20px; line-height: 1.7; }
.not-found { text-align: center; padding: 40px 20px; }
.nf-icon { font-size: 36px; margin-bottom: 12px; }
.nf-title { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
.nf-sub { font-size: 13px; color: #888; line-height: 1.6; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
.form-group label { display: block; font-size: 12px; color: #888; margin-bottom: 5px; }
.form-full { margin-bottom: 10px; }
.form-full label { display: block; font-size: 12px; color: #888; margin-bottom: 5px; }
.msg { font-size: 12px; margin-top: 8px; padding: 7px 12px; border-radius: 6px; display: none; }
.msg-ok { background: rgba(34,197,94,0.15); color: #22c55e; }
.msg-err { background: rgba(239,68,68,0.1); color: #ef4444; }
.recent-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); cursor: pointer; }
.recent-row:last-child { border-bottom: none; }
.rname { font-weight: 500; font-size: 14px; }
.ruid { font-family: monospace; font-size: 11px; color: #555; margin-top: 2px; }
.rdate { font-size: 11px; color: #555; }
.wl-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
.wl-row:last-child { border-bottom: none; }
.empty { text-align: center; padding: 28px; font-size: 13px; color: #555; }
.loading { text-align: center; padding: 28px; color: #555; font-size: 13px; }
@media(max-width:480px) { .form-grid { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<nav>
  <div class="logo">Track<span>UIDS</span><span class="nav-tag">COD:M Global</span></div>
  <div style="font-size:12px;color:#555">Community database</div>
</nav>
<div class="container">
  <div class="tabs" id="tabbar">
    <button class="tab active" id="tab-btn-search">Search</button>
    <button class="tab" id="tab-btn-log">Log UID</button>
    <button class="tab" id="tab-btn-recent">Recent</button>
    <button class="tab" id="tab-btn-watchlist">Watchlist</button>
  </div>

  <div class="page active" id="page-search">
    <div class="search-box">
      <div class="srow">
        <input type="text" id="uid-in" placeholder="Enter UID or name..." maxlength="50">
        <button class="btn" id="search-btn">Search</button>
      </div>
      <div class="hint">Only real logged data shown — no fake profiles.</div>
    </div>
    <div id="v-hero">
      <div class="hero">
        <h1>Track any <span>UID</span></h1>
        <p>Community-powered COD:Mobile Global tracker. Search a UID to see name, name history, streamer alias, and activity.</p>
      </div>
    </div>
    <div id="v-loading" class="loading" style="display:none">Looking up...</div>
    <div id="v-result" style="display:none"></div>
    <div id="v-notfound" style="display:none">
      <div class="card">
        <div class="not-found">
          <div class="nf-icon">👤</div>
          <div class="nf-title">UID not found</div>
          <div class="nf-sub">Not logged yet. Go to <strong>Log UID</strong> to add them.</div>
        </div>
      </div>
    </div>
  </div>

  <div class="page" id="page-log">
    <div class="card">
      <div class="sec">Log a player</div>
      <p style="font-size:13px;color:#888;margin-bottom:16px">Add a player from their in-game profile. Shared with everyone instantly.</p>
      <div class="form-grid">
        <div class="form-group"><label>UID *</label><input type="text" id="f-uid" placeholder="UID" maxlength="25"></div>
        <div class="form-group"><label>Current name *</label><input type="text" id="f-name" placeholder="In-game name" maxlength="50"></div>
      </div>
      <div class="form-grid">
        <div class="form-group"><label>Rank</label><input type="text" id="f-rank" placeholder="e.g. Legendary"></div>
        <div class="form-group"><label>Level</label><input type="number" id="f-lvl" placeholder="e.g. 150" min="1" max="400"></div>
      </div>
      <div class="form-full"><label>Streamer mode alias</label><input type="text" id="f-streamer" placeholder="Name when streamer mode is on" maxlength="50"></div>
      <div class="form-full"><label>Previous names (comma separated)</label><input type="text" id="f-prev" placeholder="OldName1, OldName2"></div>
      <div class="form-full"><label>Last seen / notes</label><input type="text" id="f-seen" placeholder="e.g. 2h ago in Ranked BR"></div>
      <button class="btn" id="log-btn" style="width:100%">Save to database</button>
      <div class="msg msg-ok" id="log-ok">Saved! Anyone can now look up this UID.</div>
      <div class="msg msg-err" id="log-err">UID and current name are required.</div>
    </div>
  </div>

  <div class="page" id="page-recent">
    <div class="card">
      <div class="sec">Recently logged / updated</div>
      <div id="recent-body"><div class="loading">Loading...</div></div>
    </div>
  </div>

  <div class="page" id="page-watchlist">
    <div class="card">
      <div class="sec">Your watchlist</div>
      <div id="wl-body"></div>
    </div>
  </div>
</div>

<script>
// Tab switching - pure DOM, no onclick in HTML
var tabs = ['search','log','recent','watchlist'];
tabs.forEach(function(t) {
  var btn = document.getElementById('tab-btn-' + t);
  btn.addEventListener('click', function() { switchTab(t); });
  btn.addEventListener('touchend', function(e) { e.preventDefault(); switchTab(t); });
});

function switchTab(t) {
  tabs.forEach(function(id) {
    document.getElementById('page-' + id).className = 'page' + (id === t ? ' active' : '');
    document.getElementById('tab-btn-' + id).className = 'tab' + (id === t ? ' active' : '');
  });
  if (t === 'recent') loadRecent();
  if (t === 'watchlist') renderWL();
}

// Search
document.getElementById('search-btn').addEventListener('click', doSearch);
document.getElementById('search-btn').addEventListener('touchend', function(e) { e.preventDefault(); doSearch(); });
document.getElementById('uid-in').addEventListener('keydown', function(e) { if (e.key === 'Enter') doSearch(); });

async function doSearch() {
  var q = document.getElementById('uid-in').value.trim();
  if (!q) return;
  document.getElementById('v-hero').style.display = 'none';
  document.getElementById('v-result').style.display = 'none';
  document.getElementById('v-notfound').style.display = 'none';
  document.getElementById('v-loading').style.display = 'block';
  try {
    var player = null;
    if (/^\d+$/.test(q)) {
      var r = await fetch('/api/player/' + encodeURIComponent(q));
      if (r.ok) player = await r.json();
    }
    if (!player) {
      var r2 = await fetch('/api/search?q=' + encodeURIComponent(q));
      var results = await r2.json();
      if (results.length === 1) player = results[0];
      else if (results.length > 1) { document.getElementById('v-loading').style.display = 'none'; showMultiple(results); return; }
    }
    document.getElementById('v-loading').style.display = 'none';
    if (!player) { document.getElementById('v-notfound').style.display = 'block'; return; }
    showPlayer(player);
  } catch(e) {
    document.getElementById('v-loading').style.display = 'none';
    document.getElementById('v-notfound').style.display = 'block';
  }
}

function showPlayer(p) {
  var names = p.names || [{name: p.name, date: 'Current', cur: true}];
  var activity = p.activity || [];
  var wl = JSON.parse(localStorage.getItem('tuid_wl') || '[]');
  var inWL = wl.some(function(w) { return w.uid === p.uid; });

  var html = '<div class="card"><div class="pname">' + esc(p.name) + '</div>'
    + '<div class="uid-mono">UID: ' + esc(p.uid) + '</div>'
    + '<div class="badges">'
    + (p.rank ? '<span class="badge b-amber">' + esc(p.rank) + '</span>' : '')
    + (p.level ? '<span class="badge b-blue">Lv. ' + esc(String(p.level)) + '</span>' : '')
    + (p.lastSeen ? '<span class="badge b-green">Seen: ' + esc(p.lastSeen) + '</span>' : '')
    + (p.streamer ? '<span class="badge b-gray">Streamer alias</span>' : '')
    + '</div>'
    + '<button class="btn-outline" id="wl-btn">' + (inWL ? 'Remove from watchlist' : 'Add to watchlist') + '</button></div>';

  html += '<div class="card"><div class="sec">Name history</div>'
    + names.map(function(n) {
        return '<div class="name-row"><span class="' + (n.cur ? 'name-cur' : '') + '">' + esc(n.name) + '</span>'
          + '<div>' + (n.cur ? '<span class="cur-tag">Current</span>' : '') + '<span class="name-date">' + esc(n.date || '') + '</span></div></div>';
      }).join('') + '</div>';

  if (p.streamer) {
    html += '<div class="card"><div class="sec">Streamer mode alias</div>'
      + '<span class="streamer-pill">' + esc(p.streamer) + '</span>'
      + '<p style="font-size:12px;color:#555;margin-top:10px">Name shown when streamer mode is active.</p></div>';
  }

  if (activity.length) {
    html += '<div class="card"><div class="sec">Activity log</div>'
      + activity.slice(0,8).map(function(a) {
          return '<div class="act-row"><div class="dot ' + (a.on ? 'd-on' : 'd-off') + '"></div><span>' + esc(a.txt) + '</span><span class="act-t">' + esc(a.time) + '</span></div>';
        }).join('') + '</div>';
  }

  document.getElementById('v-result').innerHTML = html;
  document.getElementById('v-result').style.display = 'block';

  document.getElementById('wl-btn').addEventListener('click', function() { toggleWL(p); });
}

function showMultiple(players) {
  var html = '<div class="card"><div class="sec">Multiple results</div>'
    + players.map(function(p) {
        return '<div class="recent-row" data-uid="' + esc(p.uid) + '"><div><div class="rname">' + esc(p.name) + '</div><div class="ruid">' + esc(p.uid) + '</div></div><div class="rdate">' + esc(p.rank || '') + '</div></div>';
      }).join('') + '</div>';
  document.getElementById('v-result').innerHTML = html;
  document.getElementById('v-result').style.display = 'block';
  document.querySelectorAll('.recent-row[data-uid]').forEach(function(row) {
    row.addEventListener('click', function() {
      document.getElementById('uid-in').value = this.dataset.uid;
      doSearch();
    });
  });
}

function toggleWL(p) {
  var wl = JSON.parse(localStorage.getItem('tuid_wl') || '[]');
  var idx = wl.findIndex(function(w) { return w.uid === p.uid; });
  if (idx >= 0) wl.splice(idx, 1);
  else wl.push({ uid: p.uid, name: p.name, added: new Date().toLocaleDateString() });
  localStorage.setItem('tuid_wl', JSON.stringify(wl));
  var btn = document.getElementById('wl-btn');
  if (btn) btn.textContent = wl.some(function(w) { return w.uid === p.uid; }) ? 'Remove from watchlist' : 'Add to watchlist';
}

// Log UID
document.getElementById('log-btn').addEventListener('click', logPlayer);
document.getElementById('log-btn').addEventListener('touchend', function(e) { e.preventDefault(); logPlayer(); });

async function logPlayer() {
  var uid = document.getElementById('f-uid').value.trim();
  var name = document.getElementById('f-name').value.trim();
  document.getElementById('log-ok').style.display = 'none';
  document.getElementById('log-err').style.display = 'none';
  if (!uid || !name) { document.getElementById('log-err').style.display = 'block'; return; }
  var prevRaw = document.getElementById('f-prev').value.trim();
  var body = {
    uid: uid, name: name,
    rank: document.getElementById('f-rank').value.trim() || null,
    level: document.getElementById('f-lvl').value.trim() || null,
    streamer: document.getElementById('f-streamer').value.trim() || null,
    prevNames: prevRaw ? prevRaw.split(',').map(function(s) { return s.trim(); }).filter(Boolean) : [],
    lastSeen: document.getElementById('f-seen').value.trim() || null
  };
  try {
    var r = await fetch('/api/player', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) {
      document.getElementById('log-ok').style.display = 'block';
      ['f-uid','f-name','f-rank','f-lvl','f-streamer','f-prev','f-seen'].forEach(function(id) { document.getElementById(id).value = ''; });
    } else document.getElementById('log-err').style.display = 'block';
  } catch(e) { document.getElementById('log-err').style.display = 'block'; }
}

// Recent
async function loadRecent() {
  document.getElementById('recent-body').innerHTML = '<div class="loading">Loading...</div>';
  try {
    var r = await fetch('/api/recent');
    var players = await r.json();
    if (!players.length) { document.getElementById('recent-body').innerHTML = '<div class="empty">No players logged yet.</div>'; return; }
    document.getElementById('recent-body').innerHTML = players.map(function(p) {
      return '<div class="recent-row" data-uid="' + esc(p.uid) + '"><div><div class="rname">' + esc(p.name) + '</div><div class="ruid">' + esc(p.uid) + '</div></div><div style="text-align:right">' + (p.rank ? '<div style="font-size:12px;color:#f59e0b">' + esc(p.rank) + '</div>' : '') + '<div class="rdate">' + esc(p.updatedAt || '') + '</div></div></div>';
    }).join('');
    document.querySelectorAll('#recent-body .recent-row[data-uid]').forEach(function(row) {
      row.addEventListener('click', function() {
        document.getElementById('uid-in').value = this.dataset.uid;
        switchTab('search');
        doSearch();
      });
    });
  } catch(e) { document.getElementById('recent-body').innerHTML = '<div class="empty">Failed to load.</div>'; }
}

// Watchlist
function renderWL() {
  var wl = JSON.parse(localStorage.getItem('tuid_wl') || '[]');
  var el = document.getElementById('wl-body');
  if (!wl.length) { el.innerHTML = '<div class="empty">No players on your watchlist yet.</div>'; return; }
  el.innerHTML = wl.map(function(w, i) {
    return '<div class="wl-row"><div><div style="font-weight:500">' + esc(w.name) + '</div><div style="font-family:monospace;font-size:11px;color:#555">' + esc(w.uid) + '</div></div>'
      + '<div style="display:flex;gap:6px"><button class="btn-outline" style="width:auto;padding:5px 10px" data-uid="' + esc(w.uid) + '">View</button>'
      + '<button style="background:none;border:none;color:#555;font-size:18px;cursor:pointer" data-rm="' + i + '">x</button></div></div>';
  }).join('');
  el.querySelectorAll('[data-uid]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.getElementById('uid-in').value = this.dataset.uid;
      switchTab('search');
      doSearch();
    });
  });
  el.querySelectorAll('[data-rm]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var wl2 = JSON.parse(localStorage.getItem('tuid_wl') || '[]');
      wl2.splice(parseInt(this.dataset.rm), 1);
      localStorage.setItem('tuid_wl', JSON.stringify(wl2));
      renderWL();
    });
  });
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
</script>
</body>
</html>`;
}

app.listen(PORT, '0.0.0.0', () => console.log('TrackUIDS running on port ' + PORT));
