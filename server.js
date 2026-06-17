const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json());

// ── Database helpers ──────────────────────────────────────────────
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) return { players: {} };
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch { return { players: {} }; }
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ── API ───────────────────────────────────────────────────────────
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

// ── Frontend (inline, no public folder needed) ────────────────────
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>TrackUIDS — COD:Mobile</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono&display=swap" rel="stylesheet"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0f0f0f;--bg2:#161616;--bg3:#1e1e1e;--border:rgba(255,255,255,0.08);--border2:rgba(255,255,255,0.14);--text:#f0f0f0;--text2:#9a9a9a;--text3:#555;--blue:#3b82f6;--blue-dim:rgba(59,130,246,0.12);--green:#22c55e;--green-dim:rgba(34,197,94,0.12);--amber:#f59e0b;--amber-dim:rgba(245,158,11,0.12);--red:#ef4444;--red-dim:rgba(239,68,68,0.1);--r:10px;--rs:6px}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;font-size:14px;line-height:1.5}
nav{display:flex;align-items:center;justify-content:space-between;padding:0 20px;height:54px;border-bottom:1px solid var(--border);position:sticky;top:0;z-index:10;background:var(--bg)}
.logo{font-size:16px;font-weight:600;letter-spacing:-.3px}.logo span{color:var(--blue)}
.nav-tag{font-size:10px;background:var(--blue-dim);color:var(--blue);padding:2px 8px;border-radius:20px;margin-left:8px;font-weight:500}
.container{max-width:700px;margin:0 auto;padding:24px 16px}
.tabs{display:flex;gap:2px;background:var(--bg2);padding:3px;border-radius:var(--rs);margin-bottom:20px;border:1px solid var(--border)}
.tab{flex:1;text-align:center;padding:10px 4px;font-size:13px;border-radius:4px;cursor:pointer;border:none;background:none;color:var(--text2);font-family:'Inter',sans-serif;transition:all .15s;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none}
.tab:hover{color:var(--text)}
.tab.on{background:var(--bg3);color:var(--text);font-weight:500;border:1px solid var(--border2)}
.search-box{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:14px;margin-bottom:18px}
.srow{display:flex;gap:8px}
input{background:var(--bg3);border:1px solid var(--border);border-radius:var(--rs);padding:9px 12px;font-size:14px;color:var(--text);outline:none;font-family:'Inter',sans-serif;transition:border .15s;width:100%}
input::placeholder{color:var(--text3)}
input:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(59,130,246,.1)}
.hint{font-size:12px;color:var(--text3);margin-top:7px}
.btn{background:var(--blue);color:#fff;border:none;border-radius:var(--rs);padding:9px 18px;font-size:14px;cursor:pointer;font-family:'Inter',sans-serif;font-weight:500;white-space:nowrap;transition:background .15s;flex-shrink:0}
.btn:hover{background:#2563eb}
.btn:active{transform:scale(.98)}
.btn-ghost{background:var(--bg3);border:1px solid var(--border);border-radius:var(--rs);padding:8px 14px;font-size:13px;cursor:pointer;color:var(--text2);font-family:'Inter',sans-serif;transition:all .15s;width:100%;margin-top:10px}
.btn-ghost:hover{color:var(--text);border-color:var(--border2)}
.card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:16px;margin-bottom:12px}
.sec{font-size:10px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px}
.pname{font-size:22px;font-weight:600;letter-spacing:-.4px;margin-bottom:4px}
.uid-mono{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text3);margin-bottom:12px}
.badges{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
.badge{font-size:11px;padding:3px 10px;border-radius:20px;font-weight:500}
.b-blue{background:var(--blue-dim);color:var(--blue)}
.b-amber{background:var(--amber-dim);color:var(--amber)}
.b-green{background:var(--green-dim);color:var(--green)}
.b-gray{background:rgba(255,255,255,.06);color:var(--text2)}
.name-row{display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border);font-size:13px}
.name-row:last-child{border-bottom:none}
.name-val{font-weight:500}
.name-cur{color:var(--blue)}
.name-date{font-size:12px;color:var(--text3)}
.cur-tag{font-size:10px;background:var(--blue-dim);color:var(--blue);padding:2px 7px;border-radius:20px;margin-right:5px;font-weight:500}
.streamer-pill{display:inline-block;background:var(--amber-dim);color:var(--amber);font-size:14px;font-weight:600;padding:6px 16px;border-radius:var(--rs);border:1px solid rgba(245,158,11,.2)}
.act-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px}
.act-row:last-child{border-bottom:none}
.dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.d-on{background:var(--green);box-shadow:0 0 6px var(--green)}
.d-off{background:var(--text3)}
.act-txt{flex:1}
.act-t{font-size:11px;color:var(--text3);white-space:nowrap}
.not-found{text-align:center;padding:40px 20px}
.nf-icon{font-size:36px;margin-bottom:12px}
.nf-title{font-size:16px;font-weight:600;margin-bottom:8px}
.nf-sub{font-size:13px;color:var(--text2);line-height:1.6;max-width:360px;margin:0 auto}
.hero{text-align:center;padding:48px 20px 32px}
.hero h1{font-size:28px;font-weight:600;letter-spacing:-.5px;margin-bottom:8px}
.hero h1 span{color:var(--blue)}
.hero p{font-size:14px;color:var(--text2);max-width:380px;margin:0 auto 24px;line-height:1.7}
.chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.chip{font-size:12px;padding:5px 13px;border-radius:20px;border:1px solid var(--border2);color:var(--text2)}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
.form-group{display:flex;flex-direction:column;gap:5px}
.form-label{font-size:12px;color:var(--text2)}
.form-full{margin-bottom:10px}
.form-full label{display:block;font-size:12px;color:var(--text2);margin-bottom:5px}
.recent-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer}
.recent-row:last-child{border-bottom:none}
.recent-row:hover .rname{color:var(--blue)}
.rname{font-weight:500;font-size:14px;transition:color .15s}
.ruid{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text3);margin-top:2px}
.rdate{font-size:11px;color:var(--text3)}
.wl-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)}
.wl-row:last-child{border-bottom:none}
.wl-name{font-weight:500;font-size:14px}
.wl-meta{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text3);margin-top:2px}
.btn-rm{background:none;border:none;color:var(--text3);cursor:pointer;padding:4px 8px;border-radius:4px;font-size:18px}
.btn-rm:hover{background:var(--red-dim);color:var(--red)}
.msg{font-size:12px;margin-top:8px;padding:7px 12px;border-radius:var(--rs);display:none}
.msg-ok{background:var(--green-dim);color:var(--green)}
.msg-err{background:var(--red-dim);color:var(--red)}
.empty{text-align:center;padding:28px;font-size:13px;color:var(--text3)}
.loading{text-align:center;padding:28px;color:var(--text3);font-size:13px}
@media(max-width:480px){.form-grid{grid-template-columns:1fr}.pname{font-size:18px}}
</style>
</head>
<body>
<nav>
  <div class="logo">Track<span>UIDS</span><span class="nav-tag">COD:M Global</span></div>
  <div style="font-size:12px;color:var(--text3)">Community database</div>
</nav>
<div class="container">
  <div class="tabs">
    <button class="tab on" id="t-search" ontouchend="goTab('search',this)" onclick="goTab('search',this)">Search</button>
    <button class="tab" id="t-log" ontouchend="goTab('log',this)" onclick="goTab('log',this)">Log UID</button>
    <button class="tab" id="t-recent" ontouchend="goTab('recent',this)" onclick="goTab('recent',this)">Recent</button>
    <button class="tab" id="t-watchlist" ontouchend="goTab('watchlist',this)" onclick="goTab('watchlist',this)">Watchlist</button>
  </div>

  <!-- SEARCH -->
  <div id="tab-search">
    <div class="search-box">
      <div class="srow">
        <input id="uid-in" placeholder="Enter UID or search by name…" maxlength="50"/>
        <button class="btn" onclick="doSearch()">Search</button>
      </div>
      <div class="hint">Search by UID or player name. Only real logged data shown — no fake profiles.</div>
    </div>
    <div id="v-hero">
      <div class="hero">
        <h1>Track any <span>UID</span></h1>
        <p>Community-powered COD:Mobile Global tracker. Search a UID to see current name, name history, streamer mode alias, and last activity.</p>
        <div class="chips">
          <span class="chip">📋 Name history</span>
          <span class="chip">🎭 Streamer mode</span>
          <span class="chip">🟢 Last activity</span>
          <span class="chip">Watchlist</span>
          <span class="chip">🌍 Global server</span>
        </div>
      </div>
    </div>
    <div id="v-loading" class="loading" style="display:none">Looking up…</div>
    <div id="v-result" style="display:none"></div>
    <div id="v-notfound" style="display:none">
      <div class="card">
        <div class="not-found">
          <div class="nf-icon">👤</div>
          <div class="nf-title">UID not found</div>
          <div class="nf-sub">This UID hasn't been logged yet. Switch to <strong>Log UID</strong> to add them.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- LOG -->
  <div id="tab-log" style="display:none">
    <div class="card">
      <div class="sec">Log a player</div>
      <p style="font-size:13px;color:var(--text2);margin-bottom:16px">Add a player using info from their in-game profile. Shared with everyone instantly.</p>
      <div class="form-grid">
        <div class="form-group"><label class="form-label">UID *</label><input id="f-uid" placeholder="UID" maxlength="25"/></div>
        <div class="form-group"><label class="form-label">Current name *</label><input id="f-name" placeholder="In-game name" maxlength="50"/></div>
      </div>
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Rank</label><input id="f-rank" placeholder="e.g. Legendary"/></div>
        <div class="form-group"><label class="form-label">Level</label><input id="f-lvl" placeholder="e.g. 150" type="number" min="1" max="400"/></div>
      </div>
      <div class="form-full"><label>Streamer mode alias</label><input id="f-streamer" placeholder="Name shown when streamer mode is on" maxlength="50"/></div>
      <div class="form-full"><label>Previous names <span style="color:var(--text3)">(comma separated)</span></label><input id="f-prev" placeholder="e.g. OldName1, OldName2"/></div>
      <div class="form-full"><label>Last seen / notes</label><input id="f-seen" placeholder="e.g. 2h ago, in Ranked BR"/></div>
      <button class="btn" onclick="logPlayer()" style="width:100%">Save to shared database</button>
      <div class="msg msg-ok" id="log-ok">✓ Saved! Anyone can now look up this UID.</div>
      <div class="msg msg-err" id="log-err">UID and current name are required.</div>
    </div>
  </div>

  <!-- RECENT -->
  <div id="tab-recent" style="display:none">
    <div class="card">
      <div class="sec">Recently logged / updated</div>
      <div id="recent-body"><div class="loading">Loading…</div></div>
    </div>
  </div>

  <!-- WATCHLIST -->
  <div id="tab-watchlist" style="display:none">
    <div class="card">
      <div class="sec">Your watchlist <span style="font-size:10px;color:var(--text3)">(saved in this browser)</span></div>
      <div id="wl-body"></div>
    </div>
  </div>
</div>

<script>
let wl = JSON.parse(localStorage.getItem('tuid_wl')||'[]');

function goTab(t,btn){
  if(window._tabLock) return;
  window._tabLock = true;
  setTimeout(()=>window._tabLock=false, 300);
  ['search','log','recent','watchlist'].forEach(id=>{
    document.getElementById('tab-'+id).style.display=id===t?'':'none';
  });
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  if(t==='recent')loadRecent();
  if(t==='watchlist')renderWL();
}

async function doSearch(){
  const q=document.getElementById('uid-in').value.trim();
  if(!q)return;
  ['v-hero','v-result','v-notfound'].forEach(id=>document.getElementById(id).style.display='none');
  document.getElementById('v-loading').style.display='block';
  try{
    const isUID=/^\d+$/.test(q);
    let player=null;
    if(isUID){
      const r=await fetch('/api/player/'+encodeURIComponent(q));
      if(r.ok)player=await r.json();
    }
    if(!player){
      const r=await fetch('/api/search?q='+encodeURIComponent(q));
      const results=await r.json();
      if(results.length===1)player=results[0];
      else if(results.length>1){
        document.getElementById('v-loading').style.display='none';
        showMultiple(results);return;
      }
    }
    document.getElementById('v-loading').style.display='none';
    if(!player){document.getElementById('v-notfound').style.display='block';return;}
    showPlayer(player);
  }catch(e){
    document.getElementById('v-loading').style.display='none';
    document.getElementById('v-notfound').style.display='block';
  }
}

function showMultiple(players){
  document.getElementById('v-result').innerHTML='<div class="card"><div class="sec">Multiple results</div>'+
    players.map(p=>'<div class="recent-row" onclick=\'showPlayer('+JSON.stringify(p).replace(/'/g,"\\'")+')\'><div><div class="rname">'+esc(p.name)+'</div><div class="ruid">'+esc(p.uid)+'</div></div><div class="rdate">'+esc(p.rank||'')+'</div></div>').join('')+'</div>';
  document.getElementById('v-result').style.display='block';
}

function showPlayer(p){
  const inWL=wl.some(w=>w.uid===p.uid);
  const names=p.names||[{name:p.name,date:'Current',cur:true}];
  const activity=p.activity||[];
  let html='<div class="card"><div class="pname">'+esc(p.name)+'</div><div class="uid-mono">UID: '+esc(p.uid)+'</div><div class="badges">'
    +(p.rank?'<span class="badge b-amber">'+esc(p.rank)+'</span>':'')
    +(p.level?'<span class="badge b-blue">Lv. '+esc(String(p.level))+'</span>':'')
    +(p.lastSeen?'<span class="badge b-green">Seen: '+esc(p.lastSeen)+'</span>':'')
    +(p.streamer?'<span class="badge b-gray">Has streamer alias</span>':'')
    +'</div><button class="btn-ghost" id="wl-btn" onclick=\'toggleWL('+JSON.stringify(p).replace(/'/g,"\\'")+')\'>'
    +(inWL?'🔔 Remove from watchlist':'🔔 Add to watchlist')+'</button></div>';

  html+='<div class="card"><div class="sec">Name history</div>'
    +names.map(n=>'<div class="name-row"><span class="name-val '+(n.cur?'name-cur':'')+'">'+esc(n.name)+'</span><div>'+(n.cur?'<span class="cur-tag">Current</span>':'')+'<span class="name-date">'+esc(n.date||'')+'</span></div></div>').join('')+'</div>';

  if(p.streamer){
    html+='<div class="card"><div class="sec">Streamer mode alias</div><span class="streamer-pill">'+esc(p.streamer)+'</span><p style="font-size:12px;color:var(--text3);margin-top:10px">Name shown when streamer mode is active.</p></div>';
  }

  if(activity.length){
    html+='<div class="card"><div class="sec">Activity log</div>'
      +activity.slice(0,8).map(a=>'<div class="act-row"><div class="dot '+(a.on?'d-on':'d-off')+'"></div><span class="act-txt">'+esc(a.txt)+'</span><span class="act-t">'+esc(a.time)+'</span></div>').join('')+'</div>';
  }

  document.getElementById('v-result').innerHTML=html;
  document.getElementById('v-result').style.display='block';
}

function toggleWL(p){
  const idx=wl.findIndex(w=>w.uid===p.uid);
  if(idx>=0)wl.splice(idx,1);
  else wl.push({uid:p.uid,name:p.name,added:new Date().toLocaleDateString()});
  localStorage.setItem('tuid_wl',JSON.stringify(wl));
  const btn=document.getElementById('wl-btn');
  if(btn)btn.textContent=wl.some(w=>w.uid===p.uid)?'🔔 Remove from watchlist':'🔔 Add to watchlist';
}

async function logPlayer(){
  const uid=document.getElementById('f-uid').value.trim();
  const name=document.getElementById('f-name').value.trim();
  ['log-ok','log-err'].forEach(id=>document.getElementById(id).style.display='none');
  if(!uid||!name){document.getElementById('log-err').style.display='block';return;}
  const prevRaw=document.getElementById('f-prev').value.trim();
  const body={uid,name,
    rank:document.getElementById('f-rank').value.trim()||null,
    level:document.getElementById('f-lvl').value.trim()||null,
    streamer:document.getElementById('f-streamer').value.trim()||null,
    prevNames:prevRaw?prevRaw.split(',').map(s=>s.trim()).filter(Boolean):[],
    lastSeen:document.getElementById('f-seen').value.trim()||null};
  try{
    const r=await fetch('/api/player',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(r.ok){
      document.getElementById('log-ok').style.display='block';
      ['f-uid','f-name','f-rank','f-lvl','f-streamer','f-prev','f-seen'].forEach(id=>document.getElementById(id).value='');
    } else document.getElementById('log-err').style.display='block';
  }catch{document.getElementById('log-err').style.display='block';}
}

async function loadRecent(){
  document.getElementById('recent-body').innerHTML='<div class="loading">Loading…</div>';
  try{
    const r=await fetch('/api/recent');
    const players=await r.json();
    if(!players.length){document.getElementById('recent-body').innerHTML='<div class="empty">No players logged yet.</div>';return;}
    document.getElementById('recent-body').innerHTML=players.map(p=>
      '<div class="recent-row" onclick="viewPlayer(\''+esc(p.uid)+'\')"><div><div class="rname">'+esc(p.name)+'</div><div class="ruid">'+esc(p.uid)+'</div></div><div style="text-align:right">'+(p.rank?'<div style="font-size:12px;color:var(--amber)">'+esc(p.rank)+'</div>':'')+'<div class="rdate">'+esc(p.updatedAt||'')+'</div></div></div>'
    ).join('');
  }catch{document.getElementById('recent-body').innerHTML='<div class="empty">Failed to load.</div>';}
}

function viewPlayer(uid){
  document.getElementById('uid-in').value=uid;
  goTab('search',document.querySelectorAll('.tab')[0]);
  doSearch();
}

function renderWL(){
  const el=document.getElementById('wl-body');
  if(!wl.length){el.innerHTML='<div class="empty">No players on your watchlist yet.</div>';return;}
  el.innerHTML=wl.map((w,i)=>'<div class="wl-row"><div><div class="wl-name">'+esc(w.name)+'</div><div class="wl-meta">'+esc(w.uid)+' · Added '+esc(w.added)+'</div></div><div style="display:flex;gap:6px;align-items:center"><button class="btn-ghost" onclick="viewPlayer(\''+esc(w.uid)+'\')" style="width:auto;margin:0;padding:5px 10px;font-size:12px">View</button><button class="btn-rm" onclick="rmWL('+i+')">✕</button></div></div>').join('');
}

function rmWL(i){wl.splice(i,1);localStorage.setItem('tuid_wl',JSON.stringify(wl));renderWL();}

function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

document.getElementById('uid-in').addEventListener('keydown',e=>{if(e.key==='Enter')doSearch();});
</script>
</body>
</html>`;

app.get('/', (req, res) => res.send(HTML));
app.use((req, res) => res.send(HTML));

app.listen(PORT, '0.0.0.0', () => console.log(`TrackUIDS running on port ${PORT}`));
